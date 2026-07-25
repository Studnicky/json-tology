import type { CurieInterface } from '../interfaces/CurieInterface.js';
import type {
  DefaultGraph, NamedNode
} from '@rdfjs/types';
import type { IdentityType } from './IdentityType.js';

/** Pre-built options object passed to QuadFactory.quad — avoids per-call allocation.
 *
 * @remarks
 * Constructed once per projection pass and reused across every quad emitted
 * within that pass. Carries the optional CURIE handler and the target named
 * graph term so callers do not re-derive them on every quad.
 *
 * @example
 * ```ts
 * const quadOptions: QuadOptionsType = { curie, graph: graphTerm };
 * ```
 *
 * @category Projection
 * @since 0.10.0
 * @see {@link ProjectInstanceArgumentListType}
 * @group ABox
 */
export type QuadOptionsType = IdentityType<{
  'curie'?: CurieInterface | undefined;
  'graph'?: DefaultGraph | NamedNode | undefined;
}>;
