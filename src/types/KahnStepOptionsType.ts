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
  readonly 'current': string;
  /** Forward dependency map. */
  readonly 'deps': BuildDepsMapType;
  /** Mutable in-degree map (updated in-place). */
  readonly 'fwdInDegree': BuildInDegreeMapType;
  /** Queue of IRIs ready to emit (appended in-place). */
  readonly 'queue': string[];
  /** Set of already-visited IRIs. */
  readonly 'visited': Set<string>;
};
