import type { SchemaGraphNodeInterface } from '../../interfaces/SchemaGraphNodeInterface.js';
import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphInterface.js';
import type { EffectivePropertyMapInterface } from '../../interfaces/EffectivePropertyMapInterface.js';

/**
 * Collect the effective property set for a schema graph node.
 *
 * Walks own `properties`, then `allOf` members (recursively), then
 * `thenNode` and `elseNode` conditional branches. Cross-graph `$ref` members
 * (where `sem.ref` is not `'#'`-prefixed) are resolved via `resolveGraph` when
 * provided: the caller passes `(referenceId) => registry.graph(referenceId)` for
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
 * @param resolveGraph - Optional resolver: `(referenceId) => SchemaGraphInterface | undefined`.
 *   When provided and a non-fragment `$ref` resolves to a registered graph, the
 *   walk descends into that graph's `rootNode`. When absent, cross-graph `$ref`
 *   nodes are skipped. Pass `(id) => registry.graph(id)` to resolve cross-graph
 *   `$ref` parents against a registry.
 * @returns Map from property name to `{ graph, node }` giving the graph and node
 *   where that property's semantics live.
 *
 * @category Graph
 * @since 0.22.0
 * @see {@link EffectivePropertyMapInterface}
 * @group Graph
 */
export class EffectiveProperties {
  /**
   * Collect the effective property set for a schema graph node.
   *
   * See the module-level documentation for the full walk semantics
   * (own properties, `allOf`, union members, conditional branches,
   * cross-graph `$ref` resolution, and cycle safety).
   *
   * @param graph - Graph containing `node`.
   * @param node - Root node from which to start the walk.
   * @param resolveGraph - Optional cross-graph resolver.
   * @returns Map from property name to `{ graph, node }`.
   */
  public static collect(
    graph: SchemaGraphInterface,
    node: SchemaGraphNodeInterface,
    resolveGraph?: (referenceId: string) => SchemaGraphInterface | undefined
  ): EffectivePropertyMapInterface {
    const collected: EffectivePropertyMapInterface = new Map();
    const visited = new Set<SchemaGraphNodeInterface>();

    EffectiveProperties.walk(graph, node, resolveGraph, collected, visited);

    return collected;
  }

  /**
   * Node-keyed memoized wrapper around {@link EffectiveProperties.collect}.
   *
   * The result is stable within a session (graphs and the registry are immutable
   * after schema registration), so caching by node identity is safe.
   *
   * @param cache - WeakMap maintained by the caller.
   * @param graph - Graph containing `node`.
   * @param node - Root node.
   * @param resolveGraph - Optional cross-graph resolver.
   * @returns Memoized effective property map.
   */
  public static collectMemo(
    cache: WeakMap<SchemaGraphNodeInterface, EffectivePropertyMapInterface>,
    graph: SchemaGraphInterface,
    node: SchemaGraphNodeInterface,
    resolveGraph?: (referenceId: string) => SchemaGraphInterface | undefined
  ): EffectivePropertyMapInterface {
    const cached = cache.get(node);

    if (cached !== undefined) {
      return cached;
    }

    const result = EffectiveProperties.collect(graph, node, resolveGraph);

    cache.set(node, result);

    return result;
  }

  /**
   * Inner recursive walker — do not call directly. Use {@link EffectiveProperties.collect}.
   */
  private static walk(
    currentGraph: SchemaGraphInterface,
    current: SchemaGraphNodeInterface,
    resolveGraph: ((referenceId: string) => SchemaGraphInterface | undefined) | undefined,
    collected: EffectivePropertyMapInterface,
    visited: Set<SchemaGraphNodeInterface>
  ): void {
    if (visited.has(current)) {
      return;
    }
    visited.add(current);

    const sem = currentGraph.semantics(current);

    // Cross-graph $ref: when a node carries a non-fragment $ref, resolve the
    // target referenceId and look it up via the caller-supplied resolver. If found,
    // descend into the target graph's rootNode instead of reading local
    // properties (the local node is a bare $ref stub with no properties).
    if (sem.ref !== undefined && !sem.ref.startsWith('#')) {
      if (resolveGraph !== undefined) {
        const referenceId = currentGraph.resolveReferenceId(sem.ref);
        const targetGraph = resolveGraph(referenceId);

        if (targetGraph !== undefined) {
          const rootNode = targetGraph.rootNode;

          // Mark the root node visited to prevent re-entry if the same
          // target appears through multiple allOf members.
          if (!visited.has(rootNode)) {
            EffectiveProperties.walk(targetGraph, rootNode, resolveGraph, collected, visited);
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
      EffectiveProperties.walk(currentGraph, member, resolveGraph, collected, visited);
    }

    // Recurse into anyOf/oneOf union members.
    // Both branches are walked because projection only emits a property when its
    // value is present in data — including inactive union members does not fabricate
    // output, only ensures each member's properties are reachable.
    for (const member of sem.anyOf) {
      EffectiveProperties.walk(currentGraph, member, resolveGraph, collected, visited);
    }
    for (const member of sem.oneOf) {
      EffectiveProperties.walk(currentGraph, member, resolveGraph, collected, visited);
    }

    // Recurse into if/then/else conditional branches.
    // Both branches are walked because projection only emits a property when its
    // value is present in data — including the inactive branch does not fabricate
    // output, only ensures the active branch's properties are reachable.
    if (sem.thenNode !== undefined) {
      EffectiveProperties.walk(currentGraph, sem.thenNode, resolveGraph, collected, visited);
    }
    if (sem.elseNode !== undefined) {
      EffectiveProperties.walk(currentGraph, sem.elseNode, resolveGraph, collected, visited);
    }
  }
}
