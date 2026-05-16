import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphImpl.js';
import type { SchemaGraphNodeInterface } from '../../interfaces/SchemaGraph.js';
import type { RefDecoderRegistryInterface } from '../../interfaces/RefDecoderRegistry.js';

import { InstantiationError } from '../../errors/InstantiationError.js';
import { Transform } from '../transform/Transform.js';
import { ValidationErrors } from '../../errors/ValidationErrors.js';
import { isRecord } from '../data/DataTypes.js';
import { GraphEngineSupport } from './GraphEngineSupport.js';

export type { RefDecoderRegistryInterface } from '../../interfaces/RefDecoderRegistry.js';

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

  // Root-level decoder is NOT applied here — callers (e.g. SchemaRegistry.instantiate)
  // apply it separately to attach the appropriate path/context to thrown errors.
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

    const parsed = GraphEngineSupport.parseRef(refTarget);
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

