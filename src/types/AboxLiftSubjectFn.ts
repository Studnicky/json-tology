import type { QuadInterface } from '../interfaces/Quad.js';

/**
 * Lifts a set of quads to typed instances of a single schema.
 *
 * @remarks
 * Injected by `JsonTology.aboxGraph` so the graph reuses the same `fromQuads`
 * path the facade exposes (predicate resolver, curie, validation via
 * `instantiate`).
 *
 * @example
 * ```ts
 * const lift: AboxLiftSubjectFnType = (classId: string, quads: QuadInterface[]) => registry.fromQuads(classId, quads);
 * ```
 *
 * @category Graph
 * @since 0.1.0
 * @see {@link AboxGraphInterface}
 * @group Graph
 */
export type AboxLiftSubjectFnType = (classId: string, quads: QuadInterface[]) => unknown[];
