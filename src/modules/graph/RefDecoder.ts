/**
 * RefDecoder — graph-native application of registered Transform decoders.
 *
 * Walks the canonical schema graph alongside a value tree and invokes any
 * registered Transform decoder at every `$ref` boundary that resolves to a
 * registered schema with a decoder attached. Recursion ordering is bottom-up:
 * nested `$ref` decoders fire before any enclosing `$ref`'s decoder, so
 * containers receive already-decoded inner values.
 *
 * Cycle detection uses a `Set` keyed by graph-node identity. A node revisited
 * on the current recursion path is not re-entered, so self-referential
 * schemas (e.g. `Person.manager: $ref Person`) terminate cleanly.
 *
 * This replaces the schema-walking implementation that previously lived as a
 * private method on `SchemaRegistry`. Per the project contract in CLAUDE.md,
 * traversal that pairs the schema with the value tree must execute against
 * the canonical graph, not a parallel raw-schema walker.
 */

import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphImpl.js';
import type { SchemaGraphNodeInterface } from '../../interfaces/SchemaGraph.js';

import { InstantiationError } from '../../errors/InstantiationError.js';
import { Transform } from '../transform/Transform.js';
import { ValidationErrors } from '../../errors/ValidationErrors.js';
import { isRecord } from '../data/DataTypes.js';
import { parseRef } from './GraphEngineSupport.js';

/**
 * Lookup function provided by the registry: given a fully-resolved schema
 * `$id`, return the registered schema object (frozen) or `undefined` if no
 * such schema is registered. Used to resolve cross-schema `$ref` targets.
 */
export type SchemaLookupType = (schemaId: string) => Record<string, unknown> | undefined;

/**
 * Lookup function provided by the registry: given a registered schema
 * object, return its canonical `SchemaGraphInterface`. Used to follow
 * cross-schema `$ref` boundaries onto the target schema's graph so the
 * decoder walk can continue beneath the referenced shape.
 */
export type GraphLookupType = (schema: Record<string, unknown>) => SchemaGraphInterface | undefined;

/**
 * Optional registry callback bundle. The decoder is graph-native but cross-
 * schema `$ref` traversal still needs the registry as the source of truth
 * for "is this `$ref` target a registered schema, and what is its graph?"
 */
export interface RefDecoderRegistryInterface {
  readonly 'getGraph': GraphLookupType;
  readonly 'getSchema': SchemaLookupType;
  readonly 'resolveSchemaId': (rawId: string) => string;
}

export class RefDecoder {
  private static decodeWithSchema(
    schema: Record<string, unknown>,
    refTarget: string,
    inner: unknown
  ): unknown {
    const decoder = Transform.getDecoder(schema);

    if (decoder === undefined) {
      return inner;
    }
    try {
      return decoder.decode(inner);
    } catch (error) {
      throw RefDecoder.wrapDecodeError(refTarget, error);
    }
  }

  /**
   * Apply registered Transform decoders along every `$ref` boundary in the
   * graph rooted at `graph`. Mutates `value` in place where a child slot is
   * replaced by its decoded form, and returns the (possibly replaced) root
   * value.
   *
   * The decoder for the root schema itself is *not* applied here — callers
   * (e.g. `SchemaRegistry.instantiate`) apply the root-level decoder
   * separately so they can attach the appropriate path/context to any
   * thrown error.
   *
   * @param graph - Canonical graph for the root schema being instantiated.
   * @param value - Value already coerced through validation; will be walked
   *   alongside the graph and mutated where decoders replace sub-values.
   * @param registry - Cross-schema lookup callbacks (see interface).
   * @returns The walked value (same reference as `value` for objects/arrays).
   */
  public static run(
    graph: SchemaGraphInterface,
    value: unknown,
    registry: RefDecoderRegistryInterface
  ): unknown {
    if (value === null || value === undefined) {
      return value;
    }

    return RefDecoder.walk(graph, graph.rootNode, value, registry, new Set());
  }

  private static walk(
    graph: SchemaGraphInterface,
    node: SchemaGraphNodeInterface,
    value: unknown,
    registry: RefDecoderRegistryInterface,
    visited: Set<SchemaGraphNodeInterface>
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
    graph: SchemaGraphInterface,
    node: SchemaGraphNodeInterface,
    value: unknown,
    registry: RefDecoderRegistryInterface,
    visited: Set<SchemaGraphNodeInterface>
  ): unknown {
    if (!isRecord(value)) {
      return value;
    }
    const semantics = graph.semantics(node);
    const additional = semantics.additionalPropertiesNode;

    if (additional === undefined || typeof additional === 'boolean') {
      return value;
    }
    const declared = new Set(semantics.properties.keys());

    for (const key of Object.keys(value)) {
      if (declared.has(key)) {
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
    graph: SchemaGraphInterface,
    node: SchemaGraphNodeInterface,
    value: unknown,
    registry: RefDecoderRegistryInterface,
    visited: Set<SchemaGraphNodeInterface>
  ): unknown {
    let current = value;
    const semantics = graph.semantics(node);

    for (const branch of semantics.oneOf) {
      current = RefDecoder.walk(graph, branch, current, registry, visited);
    }
    for (const branch of semantics.anyOf) {
      current = RefDecoder.walk(graph, branch, current, registry, visited);
    }
    for (const branch of semantics.allOf) {
      current = RefDecoder.walk(graph, branch, current, registry, visited);
    }

    return current;
  }

  private static walkInner(
    graph: SchemaGraphInterface,
    node: SchemaGraphNodeInterface,
    value: unknown,
    registry: RefDecoderRegistryInterface,
    visited: Set<SchemaGraphNodeInterface>
  ): unknown {
    const semantics = graph.semantics(node);
    const refTarget = semantics.ref;

    if (refTarget !== undefined) {
      return RefDecoder.walkRef(graph, node, refTarget, value, registry, visited);
    }

    let current = RefDecoder.walkComposition(graph, node, value, registry, visited);

    current = RefDecoder.walkProperties(graph, node, current, registry, visited);
    current = RefDecoder.walkItems(graph, node, current, registry, visited);
    current = RefDecoder.walkAdditionalProperties(graph, node, current, registry, visited);

    return current;
  }

  private static walkItems(
    graph: SchemaGraphInterface,
    node: SchemaGraphNodeInterface,
    value: unknown,
    registry: RefDecoderRegistryInterface,
    visited: Set<SchemaGraphNodeInterface>
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
    const semantics = graph.semantics(node);
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
    graph: SchemaGraphInterface,
    node: SchemaGraphNodeInterface,
    value: unknown,
    registry: RefDecoderRegistryInterface,
    visited: Set<SchemaGraphNodeInterface>
  ): unknown {
    if (!isRecord(value)) {
      return value;
    }
    const semantics = graph.semantics(node);

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
    node: SchemaGraphNodeInterface,
    refTarget: string,
    value: unknown,
    registry: RefDecoderRegistryInterface,
    visited: Set<SchemaGraphNodeInterface>
  ): unknown {
    // Local fragment ref — keep walking on the same graph beneath the
    // resolved fragment node. No cross-schema decoder applies here, but
    // the subtree may contain its own $refs to registered schemas.
    if (refTarget.startsWith('#')) {
      const semantics = graph.semantics(node);
      const localTarget = semantics.refTargetNode;

      if (localTarget === undefined) {
        return value;
      }

      return RefDecoder.walk(graph, localTarget, value, registry, visited);
    }

    const parsed = parseRef(refTarget);
    const targetId = registry.resolveSchemaId(parsed.id);
    const targetSchema = registry.getSchema(targetId);

    if (targetSchema === undefined) {
      return value;
    }

    const targetGraph = registry.getGraph(targetSchema);

    if (targetGraph === undefined) {
      // The registry knows about the schema but cannot produce a graph for
      // it — fall back to applying the root decoder for that schema only.
      return RefDecoder.decodeWithSchema(targetSchema, refTarget, value);
    }

    const targetNode = parsed.fragment === ''
      ? targetGraph.rootNode
      : targetGraph.resolveFragment(parsed.fragment);

    const inner = RefDecoder.walk(targetGraph, targetNode, value, registry, visited);

    return RefDecoder.decodeWithSchema(targetSchema, refTarget, inner);
  }

  private static wrapDecodeError(refTarget: string, error: unknown): InstantiationError {
    const causeError = error instanceof Error ? error : new Error(String(error));

    return new InstantiationError(
      new ValidationErrors([{
        'keyword': 'TRANSFORM_DECODE_FAILED',
        'message': `transform decoder failed for $ref "${refTarget}": ${causeError.message}`,
        'params': { '$ref': refTarget },
        'path': ''
      }]),
      {
        'cause': causeError,
        'code': 'TRANSFORM_DECODE_FAILED',
        'message': `transform decoder failed for $ref "${refTarget}": ${causeError.message}`
      }
    );
  }
}

