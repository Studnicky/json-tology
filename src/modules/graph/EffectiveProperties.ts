import type { SchemaGraphNodeType } from '../../types/SchemaGraph.js';
import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphImpl.js';
import type { EffectivePropertyMapType } from '../../types/EffectivePropertyMapType.js';

/**
 * Collect the effective property set for a schema graph node.
 *
 * Walks own `properties`, then `allOf` members (recursively), then
 * `thenNode` and `elseNode` conditional branches. Cross-graph `$ref` members
 * (where `sem.ref` is not `'#'`-prefixed) are resolved via `resolveGraph` when
 * provided: the caller passes `(refId) => registry.graph(refId)` for
 * registry-backed callers, or a local lookup closure for standalone callers.
 *
 * First-declaration-wins: a property declared in own `properties` shadows the
 * same name from any inherited (`allOf` / cross-graph `$ref`) source. This is
 * the single effective-property walk shared by materialization, RDF lift, and
 * ABox projection, so the canonical graph and every projection of it agree on
 * which properties a node carries.
 *
 * Cycle-safe: the `visited` set marks both pre- and post-`$ref`-resolution
 * nodes so a recursive `$ref` chain (including circular schemas) terminates.
 *
 * @remarks
 * Memoization is the caller's responsibility. This function performs no
 * caching internally so callers with different lifetimes or cache strategies
 * (WeakMap keyed on node, two-level WeakMap keyed on graph+node, etc.) can
 * apply their own policy without interference. See `collectEffectivePropertiesMemo`
 * for a ready-made node-keyed WeakMap wrapper.
 *
 * @param graph - Graph containing `node`.
 * @param node - Root node from which to start the walk.
 * @param resolveGraph - Optional resolver: `(refId) => SchemaGraphInterface | undefined`.
 *   When provided and a non-fragment `$ref` resolves to a registered graph, the
 *   walk descends into that graph's `rootNode`. When absent, cross-graph `$ref`
 *   nodes are skipped. Pass `(id) => registry.graph(id)` to resolve cross-graph
 *   `$ref` parents against a registry.
 * @returns Map from property name to `{ graph, node }` giving the graph and node
 *   where that property's semantics live.
 *
 * @category Graph
 * @since 0.22.0
 * @see {@link EffectivePropertyMapType}
 * @group Graph
 */
export function collectEffectiveProperties(
  graph: SchemaGraphInterface,
  node: SchemaGraphNodeType,
  resolveGraph?: (refId: string) => SchemaGraphInterface | undefined
): EffectivePropertyMapType {
  const collected: EffectivePropertyMapType = new Map();
  const visited = new Set<SchemaGraphNodeType>();

  walkEffectiveProperties(graph, node, resolveGraph, collected, visited);

  return collected;
}

/**
 * Node-keyed memoized wrapper around `collectEffectiveProperties`.
 *
 * The result is stable within a session (graphs and the registry are immutable
 * after schema registration), so caching by node identity is safe. The WeakMap
 * ensures no memory leak when nodes are GC'd.
 *
 * Limitation: the cache key is `node` only — it does not encode `resolveGraph`
 * identity. When the same node is queried with different resolvers (unusual in
 * practice since the resolver comes from a fixed registry), callers should
 * maintain their own two-level cache. For the standard single-registry case this
 * is always safe.
 *
 * @param cache - WeakMap maintained by the caller.
 * @param graph - Graph containing `node`.
 * @param node - Root node.
 * @param resolveGraph - Optional cross-graph resolver.
 * @returns Memoized effective property map.
 *
 * @category Graph
 * @since 0.22.0
 */
export function collectEffectivePropertiesMemo(
  cache: WeakMap<SchemaGraphNodeType, EffectivePropertyMapType>,
  graph: SchemaGraphInterface,
  node: SchemaGraphNodeType,
  resolveGraph?: (refId: string) => SchemaGraphInterface | undefined
): EffectivePropertyMapType {
  const cached = cache.get(node);

  if (cached !== undefined) {
    return cached;
  }

  const result = collectEffectiveProperties(graph, node, resolveGraph);

  cache.set(node, result);

  return result;
}

/**
 * Inner recursive walker — do not call directly. Use `collectEffectiveProperties`.
 */
function walkEffectiveProperties(
  currentGraph: SchemaGraphInterface,
  current: SchemaGraphNodeType,
  resolveGraph: ((refId: string) => SchemaGraphInterface | undefined) | undefined,
  collected: EffectivePropertyMapType,
  visited: Set<SchemaGraphNodeType>
): void {
  if (visited.has(current)) {
    return;
  }
  visited.add(current);

  const sem = currentGraph.semantics(current);

  // Cross-graph $ref: when a node carries a non-fragment $ref, resolve the
  // target refId and look it up via the caller-supplied resolver. If found,
  // descend into the target graph's rootNode instead of reading local
  // properties (the local node is a bare $ref stub with no properties).
  if (sem.ref !== undefined && !sem.ref.startsWith('#')) {
    if (resolveGraph !== undefined) {
      const refId = currentGraph.resolveRefId(sem.ref);
      const targetGraph = resolveGraph(refId);

      if (targetGraph !== undefined) {
        const rootNode = targetGraph.rootNode;

        // Mark the root node visited to prevent re-entry if the same
        // target appears through multiple allOf members.
        if (!visited.has(rootNode)) {
          walkEffectiveProperties(targetGraph, rootNode, resolveGraph, collected, visited);
          visited.add(rootNode);
        }
      }
    }

    // A cross-graph $ref stub carries no local properties — return whether
    // or not the resolver found a target (same behavior as Lift's walk).
    return;
  }

  // Collect own properties first (first-declaration-wins).
  for (const [
    name,
    propNode
  ] of sem.properties) {
    if (!collected.has(name)) {
      collected.set(name, {
        'graph': currentGraph,
        'node': propNode
      });
    }
  }

  // Recurse into allOf members.
  for (const member of sem.allOf) {
    walkEffectiveProperties(currentGraph, member, resolveGraph, collected, visited);
  }

  // Recurse into anyOf/oneOf union members.
  // Both branches are walked because projection only emits a property when its
  // value is present in data — including inactive union members does not fabricate
  // output, only ensures each member's properties are reachable.
  for (const member of sem.anyOf) {
    walkEffectiveProperties(currentGraph, member, resolveGraph, collected, visited);
  }
  for (const member of sem.oneOf) {
    walkEffectiveProperties(currentGraph, member, resolveGraph, collected, visited);
  }

  // Recurse into if/then/else conditional branches.
  // Both branches are walked because projection only emits a property when its
  // value is present in data — including the inactive branch does not fabricate
  // output, only ensures the active branch's properties are reachable.
  if (sem.thenNode !== undefined) {
    walkEffectiveProperties(currentGraph, sem.thenNode, resolveGraph, collected, visited);
  }
  if (sem.elseNode !== undefined) {
    walkEffectiveProperties(currentGraph, sem.elseNode, resolveGraph, collected, visited);
  }
}
