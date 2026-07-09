import type { CurieInterface } from '../interfaces/CurieInterface.js';
import type {
  DefaultGraph, NamedNode
} from '@rdfjs/types';

/** Pre-built options object passed to QuadFactory.quad — avoids per-call allocation.
 *
 * @remarks
 * Constructed once per projection pass and reused across every quad emitted
 * within that pass. Carries the optional CURIE handler and the target named
 * graph term so callers do not re-derive them on every quad.
 *
 * @example
 * ```ts
 * const quadOpts: QuadOptsType = { curie, graph: graphTerm };
 * ```
 *
 * @category Projection
 * @since 0.10.0
 * @see {@link ProjectInstanceArgsType}
 * @group ABox
 */
export type QuadOptsType = {
  'curie'?: CurieInterface | undefined;
  'graph'?: DefaultGraph | NamedNode | undefined;
};
