import type { QuadInterface } from './QuadInterface.js';

/**
 * Lifts a set of quads to typed instances of a single schema.
 *
 * @remarks
 * Injected by `JsonTology.aboxGraph` so the graph reuses the same `fromQuads`
 * path the facade exposes (predicate resolver, curie, validation via
 * `instantiate`).
 *
 * A callable signature, not schema-derived data — authored as an interface
 * with a call signature rather than a type alias.
 *
 * @example
 * ```ts
 * const lift: AboxLiftSubjectFunctionInterface = (classId: string, quads: QuadInterface[]) => registry.fromQuads(classId, quads);
 * ```
 *
 * @category Graph
 * @since 0.1.0
 * @see {@link AboxGraphInterface}
 * @group Graph
 */
export interface AboxLiftSubjectFunctionInterface {
  (classId: string, quads: QuadInterface[]): unknown[];
}
