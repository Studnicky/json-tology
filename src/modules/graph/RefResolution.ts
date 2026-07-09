/**
 * Canonical `$ref` → `{ graph, node }` resolver.
 *
 * This is the single source of truth for resolving a JSON Schema `$ref` string
 * into a `RefTargetType`. All resolution paths — validation, projection, and
 * materialization — delegate here.
 *
 * Resolution precedence:
 * 1. Fragment-only ref (`#...`) → resolve within the supplied `graph`.
 * 2. Parse `{ id, fragment }` from the ref via `SchemaIri.parseRef`.
 * 2a. Literal full-ref lookup: when the ref carries a `#fragment`, it may
 *     itself be a registered hash-namespace `$id` (e.g. `https://ns#Class`,
 *     the idiomatic OWL/RDF pattern). Try `lookupGraph`/`lookupSchema`/`rootId`
 *     against the ref exactly as authored before treating the `#` as
 *     JSON-Schema document-fragment syntax.
 * 3. Locate the target graph via `lookupGraph` → `lookupSchema` → `rootId` match
 *    (against the fragment-stripped id).
 * 4. If a target graph is found, resolve any fragment within it.
 * 5. Embedded-$id fallback: search the root graph's O(1) `embeddedNode` index.
 *    When found, return `{ graph: graphFor(embeddedSchema), node: rootNode }` so
 *    the returned graph can properly resolve any further fragment navigation.
 * 6. Unresolvable → throw `GraphError` with `REF_NOT_FOUND`.
 *
 * The per-engine ref cache in `GraphEngine` wraps this function and is NOT part
 * of this module.
 */

import type { RefTargetType } from '../../types/RefTargetType.js';
import type { RefResolutionOptionsType } from '../../types/RefResolutionOptionsType.js';
import type { LoggerInterface } from '../../interfaces/LoggerInterface.js';
import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphInterface.js';
import { GraphError } from '../../errors/GraphError.js';
import { GRAPH_ERROR_CODE } from '../../constants/ERROR_CODES.js';
import { SchemaIri } from './SchemaIri.js';
import { SchemaGraph } from './SchemaGraph.js';
import { DataType } from '../data/DataType.js';
import { LogScope } from '../data/LogScope.js';
import { SILENT_LOGGER } from '../../constants/LOGGER.js';

/** Graph — builds a SchemaGraph from a raw schema. */
class Graph {
  /** Build a SchemaGraph from a raw schema, preferring the caller-supplied cache. */
  static build(
    schema: Record<string, unknown>,
    options: RefResolutionOptionsType
  ): SchemaGraphInterface {
    if (options.graphFor !== undefined) {
      return options.graphFor(schema);
    }

    return new SchemaGraph(schema);
  }
}

/** InGraph — resolves an optional fragment within a graph. */
class InGraph {
  /** Resolve an optional fragment within a graph and return the `RefTargetType`. */
  static resolve(
    targetGraph: SchemaGraphInterface,
    fragment: string
  ): RefTargetType {
    if (fragment === '' || fragment === '/') {
      return {
        'graph': targetGraph,
        'node': targetGraph.rootNode
      };
    }

    return {
      'graph': targetGraph,
      'node': targetGraph.resolveFragment(fragment)
    };
  }
}

/**
 * LiteralRef — resolves a `$ref` as a literal, exact registered `$id` — i.e.
 * without fragment-stripping.
 */
class LiteralRef {
  /**
   * Try resolving `ref` as a literal, exact registered `$id` — i.e. without
   * fragment-stripping. Mirrors steps 3a/3b/3c/5 of `RefResolution.resolve`, but
   * keyed on the ref exactly as authored so a hash-namespace `$id` (e.g.
   * `https://ns#Class`) matches even though it contains a `#`.
   *
   * Returns `undefined` when no literal match is found, so the caller falls
   * through to the fragment-stripped resolution path unchanged.
   */
  static resolve(
    ref: string,
    graph: SchemaGraphInterface,
    options: RefResolutionOptionsType
  ): RefTargetType | undefined {
    const literalGraph = options.lookupGraph?.(ref);

    if (literalGraph !== undefined) {
      return InGraph.resolve(literalGraph, '');
    }

    const literalSchema = options.lookupSchema?.(ref);

    if (literalSchema !== undefined) {
      return InGraph.resolve(Graph.build(literalSchema, options), '');
    }

    if (options.rootId !== undefined && ref === options.rootId && options.rootSchema !== undefined) {
      return InGraph.resolve(Graph.build(options.rootSchema, options), '');
    }

    const embeddedLookupGraph = options.rootSchema === undefined
      ? graph
      : Graph.build(options.rootSchema, options);
    const embeddedNode = embeddedLookupGraph.embeddedNode(ref);

    if (embeddedNode !== undefined && DataType.isRecord(embeddedNode.schema)) {
      return InGraph.resolve(Graph.build(embeddedNode.schema, options), '');
    }

    return undefined;
  }
}

/**
 * RefResolution — canonical `$ref` → `{ graph, node }` resolver.
 */
export class RefResolution {
  /**
   * Resolve `ref` to a `{ graph, node }` pair using the supplied lookup options.
   *
   * @param ref      - The `$ref` string from the authored JSON Schema.
   * @param graph    - The graph that owns the node carrying this `$ref`; used for
   *                   fragment-only refs and embedded-$id fallback.
   * @param options  - Lookup callbacks, root-schema context, and an optional logger.
   * @returns `RefTargetType` — never `undefined`. Throws on miss.
   * @throws `GraphError` with code `REF_NOT_FOUND` when the ref ID cannot be resolved.
   * @throws `GraphError` with code `ANCHOR_NOT_FOUND` (from `graph.resolveFragment`)
   *         when the fragment names a missing anchor.
   */
  public static resolve(
    ref: string,
    graph: SchemaGraphInterface,
    options: RefResolutionOptionsType = {}
  ): RefTargetType {
    const logger: LoggerInterface = options.logger ?? SILENT_LOGGER;

    logger.trace(LogScope.format('RefResolution', 'resolve', `resolving $ref: ${ref}`));

    // Step 1: fragment-only ref — resolve within the current graph.
    if (ref.startsWith('#')) {
      return {
        graph,
        'node': graph.resolveFragment(ref.slice(1))
      };
    }

    // Step 2: parse the ref into an id and optional fragment.
    const parsed = SchemaIri.parseRef(ref);

    // Step 2a: literal full-ref lookup. Only meaningful when the ref carries
    // a `#fragment` — otherwise `ref === parsed.id` and step 3 already covers it.
    if (parsed.fragment !== '') {
      const literalTarget = LiteralRef.resolve(ref, graph, options);

      if (literalTarget !== undefined) {
        return literalTarget;
      }
    }

    // Step 3a: external graph lookup.
    const externalGraph = options.lookupGraph?.(parsed.id);

    if (externalGraph !== undefined) {
      return InGraph.resolve(externalGraph, parsed.fragment);
    }

    // Step 3b: raw schema lookup → build a new graph.
    const rawSchema = options.lookupSchema?.(parsed.id);

    if (rawSchema !== undefined) {
      const builtGraph = Graph.build(rawSchema, options);

      return InGraph.resolve(builtGraph, parsed.fragment);
    }

    // Step 3c: self-ref short-circuit — ref points at the root schema itself.
    if (options.rootId !== undefined && parsed.id === options.rootId && options.rootSchema !== undefined) {
      const rootGraph = Graph.build(options.rootSchema, options);

      return InGraph.resolve(rootGraph, parsed.fragment);
    }

    // Step 5: embedded-$id fallback via O(1) index on the root graph.
    // Use the supplied graph as the root graph for the embeddedNode lookup.
    // If a rootSchema is provided we can build a graph from it (hitting the
    // graphFor cache), otherwise fall back to the already-constructed `graph`.
    const embeddedLookupGraph = options.rootSchema === undefined
      ? graph
      : Graph.build(options.rootSchema, options);
    const embeddedNode = embeddedLookupGraph.embeddedNode(parsed.id);

    if (embeddedNode !== undefined && DataType.isRecord(embeddedNode.schema)) {
      // Build (or retrieve from cache) a sub-graph rooted at the embedded schema.
      // This matches GraphEngine's pattern: subsequent fragment navigation can be
      // performed against the sub-graph rather than requiring pointer arithmetic
      // within the parent graph.
      const embeddedGraph = Graph.build(embeddedNode.schema, options);

      return InGraph.resolve(embeddedGraph, parsed.fragment);
    }

    // Step 6: unresolvable.
    logger.debug(LogScope.format('RefResolution', 'resolve', `resolution miss for $ref: ${ref}`));

    throw new GraphError(`Unresolved schema reference: ${ref}`, {
      'code': GRAPH_ERROR_CODE.REF_NOT_FOUND,
      'pointer': ref
    });
  }
}
