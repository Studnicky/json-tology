import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphInterface.js';
import type {
  SchemaGraphNodeType, SchemaGraphSemanticsType
} from '../../types/SchemaGraph.js';
import type { RefDecoderRegistryType } from '../../types/RefDecoderRegistryType.js';
import type { ResolvedRefTargetType } from '../../types/ResolvedRefTargetType.js';

import { BaseError } from '../../errors/BaseError.js';
import { DecodeError } from '../../errors/DecodeError.js';
import { TransformError } from '../../errors/TransformError.js';
import { TransformErrorCode } from '../../constants/ERROR_CODES.js';
import { Transform } from '../transform/Transform.js';
import { isRecord } from '../data/DataTypes.js';
import { logScope } from '../data/LogScope.js';
import { SILENT_LOGGER } from '../../constants/LOGGER.js';
import type { LoggerInterface } from '../../interfaces/LoggerInterface.js';
import { SchemaIri } from './SchemaIri.js';

/**
 * Per-graph cache: source node → resolved cross-schema ref target (or null sentinel).
 * Keyed on graph identity so caches are scoped to the graph instance and GC'd with it.
 * `null` means the ref was previously resolved but found unresolvable — stored
 * explicitly so unresolvable refs do not trigger re-resolution on every value walk.
 */
const refTargetCache = new WeakMap<
  SchemaGraphInterface,
  WeakMap<SchemaGraphNodeType, null | ResolvedRefTargetType>
>();

function getGraphCache(graph: SchemaGraphInterface): WeakMap<SchemaGraphNodeType, null | ResolvedRefTargetType> {
  const existing = refTargetCache.get(graph);

  if (existing !== undefined) {
    return existing;
  }
  const cache = new WeakMap<SchemaGraphNodeType, null | ResolvedRefTargetType>();

  refTargetCache.set(graph, cache);

  return cache;
}

/**
 * RefDecoder — walks a schema graph and applies Transform decoders at every `$ref` boundary.
 *
 * @remarks
 * Traverses the canonical graph rooted at a `SchemaGraphInterface`, following
 * `$ref`, composition keywords (`oneOf`, `anyOf`, `allOf`), `properties`,
 * `items`/`prefixItems`, and `additionalProperties`. At each cross-schema
 * `$ref` boundary the target schema's registered Transform decoder is applied.
 *
 * @example
 * ```ts
 * const decoded = RefDecoder.run(graph, value, registry);
 * ```
 *
 * @category Graph
 * @since 0.1.0
 * @see {@link RefDecoderInterface}
 * @group Graph
 */
export class RefDecoder {
  private static decodeWithSchema(
    schema: Record<string, unknown>,
    inner: unknown
  ): unknown {
    const decoder = Transform.getDecoder(schema);

    if (decoder === undefined) {
      return inner;
    }
    try {
      return decoder.decode(inner);
    } catch (error) {
      if (error instanceof TransformError) {
        throw error;
      }
      const causeError = BaseError.toCause(error);
      const schemaId = typeof schema.$id === 'string' ? schema.$id : undefined;

      throw new DecodeError(
        `transform decoder failed${schemaId === undefined ? '' : ` for ${schemaId}`}: ${causeError.message}`,
        schemaId === undefined
          ? {
            'cause': causeError,
            'code': TransformErrorCode.TRANSFORM_DECODE_FAILED,
            'direction': 'decode',
            'path': ''
          }
          : {
            'cause': causeError,
            'code': TransformErrorCode.TRANSFORM_DECODE_FAILED,
            'direction': 'decode',
            'path': '',
            'schemaId': schemaId
          }
      );
    }
  }

  // Root-level decoder is NOT applied here — callers (e.g. SchemaRegistry.instantiate)
  // apply it separately to attach the appropriate path/context to thrown errors.
  public static run(
    graph: SchemaGraphInterface,
    value: unknown,
    registry: RefDecoderRegistryType,
    logger: LoggerInterface = SILENT_LOGGER
  ): unknown {
    if (value === null || value === undefined) {
      return value;
    }

    try {
      return RefDecoder.walk(graph, graph.rootNode, value, registry, new Set());
    } catch (error) {
      if (error instanceof DecodeError) {
        logger.error(logScope('RefDecoder', 'run', `ref decode failed: ${error.message}`));
      }
      throw error;
    }
  }

  private static walk(
    graph: SchemaGraphInterface,
    node: SchemaGraphNodeType,
    value: unknown,
    registry: RefDecoderRegistryType,
    visited: Set<SchemaGraphNodeType>
  ): unknown {
    if (value === null || value === undefined) {
      return value;
    }
    if (visited.has(node)) {
      return value;
    }
    visited.add(node);
    try {
      return RefDecoder.walkInner(graph, node, value, registry, visited);
    } finally {
      visited.delete(node);
    }
  }

  private static walkAdditionalProperties(
    semantics: SchemaGraphSemanticsType,
    graph: SchemaGraphInterface,
    value: unknown,
    registry: RefDecoderRegistryType,
    visited: Set<SchemaGraphNodeType>
  ): unknown {
    if (!isRecord(value)) {
      return value;
    }
    const additional = semantics.additionalPropertiesNode;

    if (additional === undefined || typeof additional === 'boolean') {
      return value;
    }
    for (const key of Object.keys(value)) {
      if (semantics.properties.has(key)) {
        continue;
      }
      const next = RefDecoder.walk(graph, additional, value[key], registry, visited);

      if (next !== value[key]) {
        value[key] = next;
      }
    }

    return value;
  }

  private static walkComposition(
    semantics: SchemaGraphSemanticsType,
    graph: SchemaGraphInterface,
    value: unknown,
    registry: RefDecoderRegistryType,
    visited: Set<SchemaGraphNodeType>
  ): unknown {
    let current = value;

    for (const branch of semantics.oneOf) {
      current = RefDecoder.walk(graph, branch, current, registry, visited);
    }
    for (const branch of semantics.anyOf) {
      current = RefDecoder.walk(graph, branch, current, registry, visited);
    }
    for (const branch of semantics.allOf) {
      current = RefDecoder.walk(graph, branch, current, registry, visited);
    }

    // Walk if/then/else conditional branches. Decoding is value-shaping, not
    // validation, so walking both then and else is correct — mirror how
    // EffectiveProperties walks both conditional branches.
    if (semantics.thenNode !== undefined) {
      current = RefDecoder.walk(graph, semantics.thenNode, current, registry, visited);
    }
    if (semantics.elseNode !== undefined) {
      current = RefDecoder.walk(graph, semantics.elseNode, current, registry, visited);
    }
    // Walk the complement (not) branch.
    if (semantics.complementNode !== undefined) {
      current = RefDecoder.walk(graph, semantics.complementNode, current, registry, visited);
    }

    return current;
  }

  private static walkInner(
    graph: SchemaGraphInterface,
    node: SchemaGraphNodeType,
    value: unknown,
    registry: RefDecoderRegistryType,
    visited: Set<SchemaGraphNodeType>
  ): unknown {
    // Resolve semantics once per node descent — immutable after graph construction.
    const semantics = graph.semantics(node);
    const refTarget = semantics.ref;

    if (refTarget !== undefined) {
      return RefDecoder.walkRef(graph, node, semantics, refTarget, value, registry, visited);
    }

    let current = RefDecoder.walkComposition(semantics, graph, value, registry, visited);

    current = RefDecoder.walkProperties(semantics, graph, current, registry, visited);
    current = RefDecoder.walkItems(semantics, graph, node, current, registry, visited);
    current = RefDecoder.walkAdditionalProperties(semantics, graph, current, registry, visited);

    return current;
  }

  private static walkItems(
    semantics: SchemaGraphSemanticsType,
    graph: SchemaGraphInterface,
    node: SchemaGraphNodeType,
    value: unknown,
    registry: RefDecoderRegistryType,
    visited: Set<SchemaGraphNodeType>
  ): unknown {
    if (!Array.isArray(value)) {
      return value;
    }
    // Tuple form: `items` is an array of per-position schemas in older
    // dialects, captured by the graph as indexed children under "items".
    // The 2020-12 dialect uses `prefixItems` for the same purpose; both
    // are merged here so behavior matches the previous schema-walking
    // implementation.
    const tupleNodes = graph.indexedChildren(node, 'items');
    const prefixNodes = semantics.prefixItems;
    const positionalNodes = tupleNodes.length > 0 ? tupleNodes : prefixNodes;

    if (positionalNodes.length > 0) {
      for (let index = 0; index < positionalNodes.length && index < value.length; index += 1) {
        const next = RefDecoder.walk(graph, positionalNodes[index], value[index], registry, visited);

        if (next !== value[index]) {
          value[index] = next;
        }
      }

      return value;
    }

    const itemsNode = semantics.itemsNode;

    if (itemsNode === undefined) {
      return value;
    }
    for (let index = 0; index < value.length; index += 1) {
      const next = RefDecoder.walk(graph, itemsNode, value[index], registry, visited);

      if (next !== value[index]) {
        value[index] = next;
      }
    }

    return value;
  }

  private static walkProperties(
    semantics: SchemaGraphSemanticsType,
    graph: SchemaGraphInterface,
    value: unknown,
    registry: RefDecoderRegistryType,
    visited: Set<SchemaGraphNodeType>
  ): unknown {
    if (!isRecord(value)) {
      return value;
    }

    for (const [
      propName,
      propNode
    ] of semantics.properties) {
      if (!(propName in value)) {
        continue;
      }
      const next = RefDecoder.walk(graph, propNode, value[propName], registry, visited);

      if (next !== value[propName]) {
        value[propName] = next;
      }
    }

    return value;
  }

  private static walkRef(
    graph: SchemaGraphInterface,
    node: SchemaGraphNodeType,
    semantics: SchemaGraphSemanticsType,
    refTarget: string,
    value: unknown,
    registry: RefDecoderRegistryType,
    visited: Set<SchemaGraphNodeType>
  ): unknown {
    // Local fragment ref — keep walking on the same graph beneath the
    // resolved fragment node. No cross-schema decoder applies here, but
    // the subtree may contain its own $refs to registered schemas.
    if (refTarget.startsWith('#')) {
      const localTarget = semantics.refTargetNode;

      if (localTarget === undefined) {
        return value;
      }

      return RefDecoder.walk(graph, localTarget, value, registry, visited);
    }

    // Per-graph, per-source-node cache for the resolved cross-schema target.
    // Resolution is node-deterministic: the same source node always resolves
    // to the same targetGraph/targetNode/targetSchema triple.
    const graphCache = getGraphCache(graph);

    if (graphCache.has(node)) {
      const cached = graphCache.get(node);

      if (cached === null || cached === undefined) {
        // Null sentinel — ref is unresolvable, return value as-is.
        return value;
      }
      // Cache hit: ResolvedRefTargetType stored.
      if (cached.targetGraph === undefined) {
        return RefDecoder.decodeWithSchema(cached.targetSchema, value);
      }
      const inner = RefDecoder.walk(cached.targetGraph, cached.targetNode, value, registry, visited);

      return RefDecoder.decodeWithSchema(cached.targetSchema, inner);
    }

    // Cache miss — resolve and store.
    const parsed = SchemaIri.parseRef(refTarget);
    const targetId = registry.resolveSchemaId(parsed.id);
    const targetSchema = registry.getSchema(targetId);

    if (targetSchema === undefined) {
      graphCache.set(node, null);

      return value;
    }

    const targetGraph = registry.getGraph(targetSchema);

    if (targetGraph === undefined) {
      // The registry knows about the schema but cannot produce a graph for
      // it — fall back to applying the root decoder for that schema only.
      graphCache.set(node, {
        'targetGraph': undefined,
        'targetNode': undefined,
        'targetSchema': targetSchema
      });

      return RefDecoder.decodeWithSchema(targetSchema, value);
    }

    const targetNode = parsed.fragment === ''
      ? targetGraph.rootNode
      : targetGraph.resolveFragment(parsed.fragment);

    graphCache.set(node, {
      'targetGraph': targetGraph,
      'targetNode': targetNode,
      'targetSchema': targetSchema
    });

    const inner = RefDecoder.walk(targetGraph, targetNode, value, registry, visited);

    return RefDecoder.decodeWithSchema(targetSchema, inner);
  }
}
