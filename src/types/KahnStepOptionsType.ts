import type {
  BuildDepsMapType, BuildInDegreeMapType
} from '../types/OwlCodegen.js';

/**
 * Options object for {@link advanceKahnStep}.
 *
 * @remarks
 * Bundles the mutable state for a single Kahn's algorithm processing step
 * into a single options shape, satisfying the parameter-count limit.
 *
 * @example
 * ```ts
 * advanceKahnStep({ current, deps, fwdInDegree, visited, queue });
 * ```
 *
 * @category Codegen
 * @since 0.18.0
 * @see {@link OwlCodegen.toTypeScript}
 * @group OWL Codegen
 */
export type KahnStepOptionsType = {
  /** The IRI currently being processed. */
  'current': string;
  /** Forward dependency map. */
  'deps': BuildDepsMapType;
  /** Mutable in-degree map (updated in-place). */
  'fwdInDegree': BuildInDegreeMapType;
  /** Queue of IRIs ready to emit (appended in-place). */
  'queue': string[];
  /** Set of already-visited IRIs. */
  'visited': Set<string>;
};
