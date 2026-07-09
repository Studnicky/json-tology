import type { DumpOptionsType } from '../../types/DumpOptionsType.js';
import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphInterface.js';
import type { SchemaGraphNodeType } from '../../types/SchemaGraph.js';
import type { SchemaRegistryInterface } from '../../interfaces/SchemaRegistryInterface.js';
import { DataType } from '../data/DataType.js';
import { Transform } from '../transform/Transform.js';
import { BaseError } from '../../errors/BaseError.js';
import { EncodeError } from '../../errors/EncodeError.js';
import { TransformError } from '../../errors/TransformError.js';
import { GraphError } from '../../errors/GraphError.js';
import {
  GraphErrorCode, TransformErrorCode
} from '../../constants/ERROR_CODES.js';
import { SchemaIri } from './SchemaIri.js';

const graphTransformCache = new WeakMap<SchemaGraphInterface, boolean>();

function graphHasTransforms(graph: SchemaGraphInterface): boolean {
  const cached = graphTransformCache.get(graph);

  if (cached !== undefined) {
    return cached;
  }

  const result = graph.nodes().some((n: SchemaGraphNodeType): boolean => {
    const s = n.schema;

    return DataType.isRecord(s) && Transform.getDecoder(s) !== undefined;
  });

  graphTransformCache.set(graph, result);

  return result;
}

function hasActiveFilterOptions(options: Omit<DumpOptionsType, 'mode'> | undefined): boolean {
  if (options === undefined) {
    return false;
  }

  return (
    (options.exclude !== undefined && options.exclude.length > 0)
    || options.excludeDefaults === true
    || options.excludeUnset === true
    || (options.include !== undefined && options.include.length > 0)
  );
}

/**
 * Dumper — serialize a validated JS value back to its wire form.
 *
 * Static-only class. Reads the canonical graph for property traversal
 * and applies any registered Transform encoder at each node.
 */
export class Dumper {
  private static applyEncoder(
    nodeSchema: Record<string, unknown>,
    node: SchemaGraphNodeType,
    value: unknown
  ): unknown {
    const encoder = Transform.getDecoder(nodeSchema);

    if (encoder === undefined) {
      return value;
    }

    try {
      return encoder.encode(value);
    } catch (error) {
      if (error instanceof TransformError) {
        throw error;
      }

      const causeError = BaseError.toCause(error);
      const schemaId = nodeSchema.$id as string | undefined;

      throw new EncodeError(
        `transform encoder failed at ${node.pointer}: ${causeError.message}`,
        {
          'cause': causeError,
          'code': TransformErrorCode.TRANSFORM_ENCODE_FAILED,
          'direction': 'encode',
          'path': node.pointer,
          ...((schemaId !== undefined) && { 'schemaId': schemaId })
        }
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private static applyJsonMode(value: unknown): unknown {
    if (value instanceof Date) {
      return value.toISOString();
    }

    if (Array.isArray(value)) {
      return value.map((item: unknown): unknown => {
        return Dumper.applyJsonMode(item);
      });
    }

    if (DataType.isRecord(value)) {
      const out: Record<string, unknown> = {};

      for (const key of Object.keys(value)) {
        out[key] = Dumper.applyJsonMode(value[key]);
      }

      return out;
    }

    return value;
  }

  /**
   * Serialize `value` to wire (or JSON-safe) form according to the schema graph.
   *
   * @param registry - Schema registry used for cross-schema $ref resolution.
   * @param schemaId - The `$id` of the root schema.
   * @param value - Value to serialize (typically the output of `coerce()`).
   * @param options - Filtering and mode options.
   * @returns Wire-form representation of the value.
   */
  public static dump(
    registry: SchemaRegistryInterface,
    schemaId: string,
    value: unknown,
    options?: DumpOptionsType
  ): unknown {
    const entry = registry.graphEntry(schemaId);

    if (entry === undefined) {
      throw new GraphError(`Schema not registered: ${schemaId}`, {
        'code': GraphErrorCode.REF_UNRESOLVED,
        'pointer': schemaId
      });
    }

    const {
      graph,
      schema
    } = entry;
    const rootNode = graph.rootNode;

    return Dumper.dumpNode({
      graph,
      'node': rootNode,
      'nodeSchema': schema,
      options,
      registry,
      value
    });
  }

  private static dumpArray(opts: {
    'graph': SchemaGraphInterface;
    'itemsNode': SchemaGraphNodeType;
    'options': DumpOptionsType | undefined;
    'registry': SchemaRegistryInterface;
    'value': unknown[];
  }): unknown[] {
    const {
      graph, itemsNode, options, registry, value
    } = opts;
    const itemSchema = itemsNode.schema;
    const nodeSchema = DataType.isRecord(itemSchema) ? itemSchema : {};

    return value.map((item: unknown): unknown => {
      return Dumper.dumpNode({
        graph,
        'node': itemsNode,
        nodeSchema,
        options,
        registry,
        'value': item
      });
    });
  }

  /**
   * Serialize `value` to a JSON string according to the schema graph.
   *
   * Fast path: when the graph has no transform decoders and no active filter
   * options, delegates directly to `JSON.stringify` without walking the graph.
   */
  public static dumpJson(
    registry: SchemaRegistryInterface,
    schemaId: string,
    value: unknown,
    options?: Omit<DumpOptionsType, 'mode'>
  ): string {
    const entry = registry.graphEntry(schemaId);

    if (entry === undefined) {
      throw new GraphError(`Schema not registered: ${schemaId}`, {
        'code': GraphErrorCode.REF_UNRESOLVED,
        'pointer': schemaId
      });
    }

    if (!graphHasTransforms(entry.graph) && !hasActiveFilterOptions(options)) {
      return JSON.stringify(value);
    }

    return JSON.stringify(Dumper.dumpNode({
      'graph': entry.graph,
      'node': entry.graph.rootNode,
      'nodeSchema': entry.schema,
      'options': {
        ...options,
        'mode': 'json'
      },
      registry,
      value
    }));
  }

  private static dumpNode(opts: {
    'graph': SchemaGraphInterface;
    'node': SchemaGraphNodeType;
    'nodeSchema': Record<string, unknown>;
    'options': DumpOptionsType | undefined;
    'registry': SchemaRegistryInterface;
    'value': unknown;
  }): unknown {
    const {
      graph, node, nodeSchema, options, registry, value
    } = opts;

    // Resolve $ref — follow to the target schema and graph
    const semantics = graph.semantics(node);

    if (semantics.ref !== undefined) {
      const resolved = Dumper.resolveRef(registry, graph, semantics.ref);

      return Dumper.dumpNode({
        'graph': resolved.graph,
        'node': resolved.node,
        'nodeSchema': resolved.schema,
        options,
        'registry': resolved.registry,
        value
      });
    }

    const projected = Dumper.applyEncoder(nodeSchema, node, value);

    // Recurse into object properties
    if (DataType.isRecord(projected) && semantics.properties.size > 0) {
      return Dumper.dumpObject({
        graph,
        node,
        options,
        registry,
        'value': projected
      });
    }
    if (Array.isArray(projected) && semantics.itemsNode !== undefined) {
      return Dumper.dumpArray({
        graph,
        'itemsNode': semantics.itemsNode,
        options,
        registry,
        'value': projected
      });
    }
    if (options?.mode === 'json') {
      return Dumper.applyJsonMode(projected);
    }

    return projected;
  }

  private static dumpObject(opts: {
    'graph': SchemaGraphInterface;
    'node': SchemaGraphNodeType;
    'options': DumpOptionsType | undefined;
    'registry': SchemaRegistryInterface;
    'value': Record<string, unknown>;
  }): Record<string, unknown> {
    const {
      graph, node, options, registry, value
    } = opts;
    const semantics = graph.semantics(node);
    const include = options?.include;
    const exclude = options?.exclude;
    const excludeUnset = options?.excludeUnset === true;
    const excludeDefaults = options?.excludeDefaults === true;
    const mode = options?.mode;
    const out: Record<string, unknown> = {};

    // Only allocated when excludeDefaults is active — used for O(1) membership test
    const knownKeys = excludeDefaults ? new Set<string>(semantics.properties.keys()) : undefined;

    for (const key of Object.keys(value)) {
      if (Dumper.isKeyFiltered(key, include, exclude)) {
        continue;
      }

      const raw = value[key];

      if (excludeUnset && raw === undefined) {
        continue;
      }

      if (excludeDefaults && Dumper.isDefaultValue(graph, semantics, knownKeys, key, raw)) {
        continue;
      }

      const propNode = semantics.properties.get(key);

      if (propNode !== undefined) {
        const propSchema = propNode.schema;

        out[key] = Dumper.dumpNode({
          graph,
          'node': propNode,
          'nodeSchema': DataType.isRecord(propSchema) ? propSchema : {},
          options,
          registry,
          'value': raw
        });
      } else if (mode === 'json') {
        out[key] = Dumper.applyJsonMode(raw);
      } else {
        out[key] = raw;
      }
    }

    return out;
  }

  private static isDefaultValue(
    graph: SchemaGraphInterface,
    semantics: ReturnType<SchemaGraphInterface['semantics']>,
    knownKeys: Set<string> | undefined,
    key: string,
    raw: unknown
  ): boolean {
    if (knownKeys?.has(key) !== true) {
      return false;
    }

    const propNode = semantics.properties.get(key);

    if (propNode === undefined) {
      return false;
    }

    const propSemantics = graph.semantics(propNode);

    return propSemantics.hasDefault && raw === propSemantics.defaultValue;
  }

  private static isKeyFiltered(
    key: string,
    include: readonly string[] | undefined,
    exclude: readonly string[] | undefined
  ): boolean {
    if (include !== undefined && include.length > 0) {
      return !include.includes(key);
    }

    return exclude?.includes(key) === true;
  }

  private static resolveRef(
    registry: SchemaRegistryInterface,
    graph: SchemaGraphInterface,
    ref: string
  ): { 'graph': SchemaGraphInterface;
    'node': SchemaGraphNodeType;
    'registry': SchemaRegistryInterface;
    'schema': Record<string, unknown> } {
    if (ref.startsWith('#')) {
      const fragment = ref.slice(1);
      const node = graph.resolveFragment(fragment);
      const schema = node.schema;

      return {
        graph,
        node,
        'registry': registry,
        'schema': DataType.isRecord(schema) ? schema : {}
      };
    }

    const parsed = SchemaIri.parseRef(ref);

    // Literal full-ref lookup first: a `#`-bearing absolute IRI may itself be
    // a registered hash-namespace `$id` (e.g. `https://ns#Class`); only fall
    // to fragment-stripped resolution when no such registration matches
    // exactly.
    const literalLookedUp = parsed.fragment === '' ? undefined : registry.graphEntry(ref);
    const lookedUp = literalLookedUp ?? registry.graphEntry(parsed.id);
    const targetFragment = literalLookedUp === undefined ? parsed.fragment : '';

    if (lookedUp === undefined) {
      throw new GraphError(`Unresolved schema reference: ${ref}`, {
        'code': GraphErrorCode.REF_UNRESOLVED,
        'pointer': ref
      });
    }

    const {
      'graph': targetGraph,
      'schema': targetSchema
    } = lookedUp;
    const targetNode = targetGraph.resolveFragment(targetFragment);

    return {
      'graph': targetGraph,
      'node': targetNode,
      'registry': registry,
      'schema': DataType.isRecord(targetNode.schema) ? targetNode.schema : targetSchema
    };
  }
}
