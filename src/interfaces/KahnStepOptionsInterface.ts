import type { StringArrayEntity } from '../entities/StringArrayEntity.js';
import type { StringValueEntity } from '../entities/StringValueEntity.js';
import type { BuildDepsMapInterface } from './BuildDepsMapInterface.js';
import type { BuildInDegreeMapInterface } from './BuildInDegreeMapInterface.js';

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
export interface KahnStepOptionsInterface {
  /** The IRI currently being processed. */
  'current': StringValueEntity.Type;
  /** Forward dependency map. */
  'deps': BuildDepsMapInterface;
  /** Mutable in-degree map (updated in-place). */
  'fwdInDegree': BuildInDegreeMapInterface;
  /** Queue of IRIs ready to emit (appended in-place). */
  'queue': StringArrayEntity.Type;
  /** Set of already-visited IRIs. */
  'visited': Set<string>;
}
