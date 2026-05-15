import type { DumpOptionsInterface } from '../../interfaces/Dump.js';
import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphImpl.js';
import type { SchemaGraphNodeInterface } from '../../interfaces/SchemaGraph.js';
import type { SchemaRegistryInterface } from '../../interfaces/SchemaRegistry.js';
import { isRecord } from './DataTypes.js';
import { Transform } from '../transform/Transform.js';
import { GraphError } from '../../errors/GraphError.js';
import { GraphEngineSupport } from '../graph/GraphEngineSupport.js';

const graphTransformCache = new WeakMap<SchemaGraphInterface, boolean>();

function graphHasTransforms(graph: SchemaGraphInterface): boolean {
  const cached = graphTransformCache.get(graph);

  if (cached !== undefined) {
    return cached;
  }

  const result = graph.nodes().some((n) => {
    const s = n.schema;

    return isRecord(s) && Transform.getDecoder(s) !== undefined;
  });

  graphTransformCache.set(graph, result);

  return result;
}

function hasActiveFilterOptions(options: Omit<DumpOptionsInterface, 'mode'> | undefined): boolean {
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
  private static applyJsonMode(value: unknown): unknown {
    if (value instanceof Date) {
      return value.toISOString();
    }

    if (Array.isArray(value)) {
      return value.map((item) => {
        return Dumper.applyJsonMode(item);
      });
    }

    if (isRecord(value)) {
      const out: Record<string, unknown> = {};

      for (const key of Object.keys(value)) {
        out[key] = Dumper.applyJsonMode(value[key]);
      }

      return out;
    }

    return value;
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

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
    options?: DumpOptionsInterface
  ): unknown {
    const entry = registry.graphEntry(schemaId);

    if (entry === undefined) {
      throw new GraphError('REF_UNRESOLVED', `Schema not registered: ${schemaId}`, schemaId);
    }

    const {
      graph,
      schema
    } = entry;
    const rootNode = graph.rootNode;

    return Dumper.dumpNode(registry, graph, rootNode, schema, value, options);
  }

  private static dumpArray(
    registry: SchemaRegistryInterface,
    graph: SchemaGraphInterface,
    itemsNode: SchemaGraphNodeInterface,
    value: unknown[],
    options?: DumpOptionsInterface
  ): unknown[] {
    const itemSchema = itemsNode.schema;

    return value.map((item) => {
      return Dumper.dumpNode(
        registry,
        graph,
        itemsNode,
        isRecord(itemSchema) ? itemSchema : {},
        item,
        options
      );
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
    options?: Omit<DumpOptionsInterface, 'mode'>
  ): string {
    const entry = registry.graphEntry(schemaId);

    if (entry === undefined) {
      throw new GraphError('REF_UNRESOLVED', `Schema not registered: ${schemaId}`, schemaId);
    }

    if (!graphHasTransforms(entry.graph) && !hasActiveFilterOptions(options)) {
      return JSON.stringify(value);
    }

    return JSON.stringify(Dumper.dumpNode(
      registry,
      entry.graph,
      entry.graph.rootNode,
      entry.schema,
      value,
      {
        ...options,
        'mode': 'json'
      }
    ));
  }

  private static dumpNode(
    registry: SchemaRegistryInterface,
    graph: SchemaGraphInterface,
    node: SchemaGraphNodeInterface,
    nodeSchema: Record<string, unknown>,
    value: unknown,
    options?: DumpOptionsInterface
  ): unknown {
    // Resolve $ref — follow to the target schema and graph
    const semantics = graph.semantics(node);

    if (semantics.ref !== undefined) {
      const ref = semantics.ref;
      const resolved = Dumper.resolveRef(registry, graph, ref);

      return Dumper.dumpNode(resolved.registry, resolved.graph, resolved.node, resolved.schema, value, options);
    }

    // Apply Transform encoder at this schema node if one is registered
    const encoder = Transform.getDecoder(nodeSchema);
    let projected = encoder === undefined ? value : encoder.encode(value);

    // Recurse into object properties
    if (isRecord(projected) && semantics.properties.size > 0) {
      projected = Dumper.dumpObject(registry, graph, node, nodeSchema, projected, options);
    } else if (Array.isArray(projected) && semantics.itemsNode !== undefined) {
      projected = Dumper.dumpArray(registry, graph, semantics.itemsNode, projected, options);
    } else if (options?.mode === 'json') {
      projected = Dumper.applyJsonMode(projected);
    }

    return projected;
  }

  private static dumpObject(
    registry: SchemaRegistryInterface,
    graph: SchemaGraphInterface,
    node: SchemaGraphNodeInterface,
    _nodeSchema: Record<string, unknown>,
    value: Record<string, unknown>,
    options?: DumpOptionsInterface
  ): Record<string, unknown> {
    const semantics = graph.semantics(node);
    const include = options?.include;
    const exclude = options?.exclude;
    const excludeUnset = options?.excludeUnset === true;
    const excludeDefaults = options?.excludeDefaults === true;
    const mode = options?.mode;

    const out: Record<string, unknown> = {};

    // Only allocated when excludeDefaults is active — used for O(1) membership test
    const knownKeys = excludeDefaults ? new Set<string>(semantics.properties.keys()) : undefined;

    // Determine effective property set to output
    const allValueKeys = Object.keys(value);

    for (const key of allValueKeys) {
      // include filter: if set, only include listed keys
      if (include !== undefined && include.length > 0 && !include.includes(key)) {
        continue;
      }

      // exclude filter: only when include is not set
      if (include === undefined && exclude?.includes(key) === true) {
        continue;
      }

      const raw = value[key];

      if (excludeUnset && raw === undefined) {
        continue;
      }

      if (excludeDefaults && knownKeys?.has(key) === true) {
        const propNode = semantics.properties.get(key);

        if (propNode !== undefined) {
          const propSemantics = graph.semantics(propNode);

          if (propSemantics.hasDefault && raw === propSemantics.defaultValue) {
            continue;
          }
        }
      }

      const propNode = semantics.properties.get(key);

      if (propNode !== undefined) {
        const propSchema = propNode.schema;

        out[key] = Dumper.dumpNode(
          registry,
          graph,
          propNode,
          isRecord(propSchema) ? propSchema : {},
          raw,
          options
        );
      } else if (mode === 'json') {
        out[key] = Dumper.applyJsonMode(raw);
      } else {
        out[key] = raw;
      }
    }

    return out;
  }

  private static resolveRef(
    registry: SchemaRegistryInterface,
    graph: SchemaGraphInterface,
    ref: string
  ): { 'graph': SchemaGraphInterface;
    'node': SchemaGraphNodeInterface;
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
        'schema': isRecord(schema) ? schema : {}
      };
    }

    const parsed = GraphEngineSupport.parseRef(ref);
    const lookedUp = registry.graphEntry(parsed.id);

    if (lookedUp === undefined) {
      throw new GraphError('REF_UNRESOLVED', `Unresolved schema reference: ${ref}`, ref);
    }

    const {
      'graph': targetGraph,
      'schema': targetSchema
    } = lookedUp;
    const targetNode = targetGraph.resolveFragment(parsed.fragment);

    return {
      'graph': targetGraph,
      'node': targetNode,
      'registry': registry,
      'schema': isRecord(targetNode.schema) ? targetNode.schema : targetSchema
    };
  }
}
