import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphInterface.js';
import type {
  SchemaGraphNodeType, SchemaGraphSemanticsType
} from '../../types/SchemaGraph.js';
import type { ReferenceDecoderRegistryType } from '../../types/ReferenceDecoderRegistryType.js';
import type { ResolvedReferenceTargetType } from '../../types/ResolvedReferenceTargetType.js';

import { BaseError } from '../../errors/BaseError.js';
import { DecodeError } from '../../errors/DecodeError.js';
import { TransformError } from '../../errors/TransformError.js';
import { TRANSFORM_ERROR_CODE } from '../../constants/ERROR_CODES.js';
import { Transform } from '../transform/Transform.js';
import { DataType } from '../data/DataType.js';
import { LogScope } from '../data/LogScope.js';
import { SILENT_LOGGER } from '../../constants/LOGGER.js';
import type { LoggerInterface } from '../../interfaces/LoggerInterface.js';
import { SchemaIri } from './SchemaIri.js';

/**
 * Per-graph cache: source node → resolved cross-schema ref target (or null sentinel).
 * Keyed on graph identity so caches are scoped to the graph instance and GC'd with it.
 * `null` means the ref was previously resolved but found unresolvable — stored
 * explicitly so unresolvable refs do not trigger re-resolution on every value walk.
 */
const referenceTargetCache = new WeakMap<
  SchemaGraphInterface,
  WeakMap<SchemaGraphNodeType, null | ResolvedReferenceTargetType>
>();

class GraphCache {
  static get(graph: SchemaGraphInterface): WeakMap<SchemaGraphNodeType, null | ResolvedReferenceTargetType> {
    const existing = referenceTargetCache.get(graph);

    if (existing !== undefined) {
      return existing;
    }
    const cache = new WeakMap<SchemaGraphNodeType, null | ResolvedReferenceTargetType>();

    referenceTargetCache.set(graph, cache);

    return cache;
  }
}

/**
 * ReferenceDecoder — walks a schema graph and applies Transform decoders at every `$ref` boundary.
 *
 * @remarks
 * Traverses the canonical graph rooted at a `SchemaGraphInterface`, following
 * `$ref`, composition keywords (`oneOf`, `anyOf`, `allOf`), `properties`,
 * `items`/`prefixItems`, and `additionalProperties`. At each cross-schema
 * `$ref` boundary the target schema's registered Transform decoder is applied.
 *
 * @example
 * ```ts
 * const decoded = ReferenceDecoder.run(graph, value, registry);
 * ```
 *
 * @category Graph
 * @since 0.1.0
 * @see {@link ReferenceDecoderInterface}
 * @group Graph
 */
export class ReferenceDecoder {
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
            'code': TRANSFORM_ERROR_CODE.TRANSFORM_DECODE_FAILED,
            'direction': 'decode',
            'path': ''
          }
          : {
            'cause': causeError,
            'code': TRANSFORM_ERROR_CODE.TRANSFORM_DECODE_FAILED,
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
    registry: ReferenceDecoderRegistryType,
    logger: LoggerInterface = SILENT_LOGGER
  ): unknown {
    if (value === null || value === undefined) {
      return value;
    }

    try {
      return ReferenceDecoder.walk(graph, graph.rootNode, value, registry, new Set());
    } catch (error) {
      if (error instanceof DecodeError) {
        logger.error(LogScope.format('ReferenceDecoder', 'run', `ref decode failed: ${error.message}`));
      }
      throw error;
    }
  }

  private static walk(
    graph: SchemaGraphInterface,
    node: SchemaGraphNodeType,
    value: unknown,
    registry: ReferenceDecoderRegistryType,
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
      return ReferenceDecoder.walkInner(graph, node, value, registry, visited);
    } finally {
      visited.delete(node);
    }
  }

  private static walkAdditionalProperties(
    semantics: SchemaGraphSemanticsType,
    graph: SchemaGraphInterface,
    value: unknown,
    registry: ReferenceDecoderRegistryType,
    visited: Set<SchemaGraphNodeType>
  ): unknown {
    if (!DataType.isRecord(value)) {
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
      const next = ReferenceDecoder.walk(graph, additional, value[key], registry, visited);

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
    registry: ReferenceDecoderRegistryType,
    visited: Set<SchemaGraphNodeType>
  ): unknown {
    let current = value;

    for (const branch of semantics.oneOf) {
      current = ReferenceDecoder.walk(graph, branch, current, registry, visited);
    }
    for (const branch of semantics.anyOf) {
      current = ReferenceDecoder.walk(graph, branch, current, registry, visited);
    }
    for (const branch of semantics.allOf) {
      current = ReferenceDecoder.walk(graph, branch, current, registry, visited);
    }

    // Walk if/then/else conditional branches. Decoding is value-shaping, not
    // validation, so walking both then and else is correct — mirror how
    // EffectiveProperties walks both conditional branches.
    if (semantics.thenNode !== undefined) {
      current = ReferenceDecoder.walk(graph, semantics.thenNode, current, registry, visited);
    }
    if (semantics.elseNode !== undefined) {
      current = ReferenceDecoder.walk(graph, semantics.elseNode, current, registry, visited);
    }
    // Walk the complement (not) branch.
    if (semantics.complementNode !== undefined) {
      current = ReferenceDecoder.walk(graph, semantics.complementNode, current, registry, visited);
    }

    return current;
  }

  private static walkInner(
    graph: SchemaGraphInterface,
    node: SchemaGraphNodeType,
    value: unknown,
    registry: ReferenceDecoderRegistryType,
    visited: Set<SchemaGraphNodeType>
  ): unknown {
    // Resolve semantics once per node descent — immutable after graph construction.
    const semantics = graph.semantics(node);
    const referenceTarget = semantics.ref;

    if (referenceTarget !== undefined) {
      return ReferenceDecoder.walkReference(graph, node, semantics, referenceTarget, value, registry, visited);
    }

    let current = ReferenceDecoder.walkComposition(semantics, graph, value, registry, visited);

    current = ReferenceDecoder.walkProperties(semantics, graph, current, registry, visited);
    current = ReferenceDecoder.walkItems(semantics, graph, node, current, registry, visited);
    current = ReferenceDecoder.walkAdditionalProperties(semantics, graph, current, registry, visited);

    return current;
  }

  private static walkItems(
    semantics: SchemaGraphSemanticsType,
    graph: SchemaGraphInterface,
    node: SchemaGraphNodeType,
    value: unknown,
    registry: ReferenceDecoderRegistryType,
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
        const positionalNode = positionalNodes[index];

        if (positionalNode === undefined) {
          continue;
        }

        const next = ReferenceDecoder.walk(graph, positionalNode, value[index], registry, visited);

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
    const itemCount = value.length;

    for (let index = 0; index < itemCount; index += 1) {
      const next = ReferenceDecoder.walk(graph, itemsNode, value[index], registry, visited);

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
    registry: ReferenceDecoderRegistryType,
    visited: Set<SchemaGraphNodeType>
  ): unknown {
    if (!DataType.isRecord(value)) {
      return value;
    }

    for (const [
      propName,
      propNode
    ] of semantics.properties) {
      if (!(propName in value)) {
        continue;
      }
      const next = ReferenceDecoder.walk(graph, propNode, value[propName], registry, visited);

      if (next !== value[propName]) {
        value[propName] = next;
      }
    }

    return value;
  }

  private static walkReference(
    graph: SchemaGraphInterface,
    node: SchemaGraphNodeType,
    semantics: SchemaGraphSemanticsType,
    referenceTarget: string,
    value: unknown,
    registry: ReferenceDecoderRegistryType,
    visited: Set<SchemaGraphNodeType>
  ): unknown {
    // Local fragment ref — keep walking on the same graph beneath the
    // resolved fragment node. No cross-schema decoder applies here, but
    // the subtree may contain its own $refs to registered schemas.
    if (referenceTarget.startsWith('#')) {
      const localTarget = semantics.refTargetNode;

      if (localTarget === undefined) {
        return value;
      }

      return ReferenceDecoder.walk(graph, localTarget, value, registry, visited);
    }

    // Per-graph, per-source-node cache for the resolved cross-schema target.
    // Resolution is node-deterministic: the same source node always resolves
    // to the same targetGraph/targetNode/targetSchema triple.
    const graphCache = GraphCache.get(graph);

    if (graphCache.has(node)) {
      const cached = graphCache.get(node);

      if (cached === null || cached === undefined) {
        // Null sentinel — ref is unresolvable, return value as-is.
        return value;
      }
      // Cache hit: ResolvedReferenceTargetType stored.
      if (cached.targetGraph === undefined) {
        return ReferenceDecoder.decodeWithSchema(cached.targetSchema, value);
      }
      const inner = ReferenceDecoder.walk(cached.targetGraph, cached.targetNode, value, registry, visited);

      return ReferenceDecoder.decodeWithSchema(cached.targetSchema, inner);
    }

    // Cache miss — resolve and store.
    const parsed = SchemaIri.parseReference(referenceTarget);

    // Literal full-ref lookup first: a `#`-bearing absolute IRI may itself be
    // a registered hash-namespace `$id` (e.g. `https://ns#Class`); only fall
    // to fragment-stripped resolution when no such registration matches
    // exactly.
    const literalSchema = parsed.fragment === ''
      ? undefined
      : registry.getSchema(registry.resolveSchemaId(referenceTarget));
    const targetSchema = literalSchema ?? registry.getSchema(registry.resolveSchemaId(parsed.id));
    const targetFragment = literalSchema === undefined ? parsed.fragment : '';

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

      return ReferenceDecoder.decodeWithSchema(targetSchema, value);
    }

    const targetNode = targetFragment === ''
      ? targetGraph.rootNode
      : targetGraph.resolveFragment(targetFragment);

    graphCache.set(node, {
      'targetGraph': targetGraph,
      'targetNode': targetNode,
      'targetSchema': targetSchema
    });

    const inner = ReferenceDecoder.walk(targetGraph, targetNode, value, registry, visited);

    return ReferenceDecoder.decodeWithSchema(targetSchema, inner);
  }
}
