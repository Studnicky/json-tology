import type { CurieInterface } from '../interfaces/Curie.js';
import type { QuadInterface } from '../interfaces/Quad.js';

/**
 * Options for {@link resolveRestrictionBnode}.
 *
 * @remarks
 * Bundles the parameters needed to resolve a restriction blank node, satisfying
 * the 3-parameter limit.
 *
 * @example
 * ```ts
 * resolveRestrictionBnode({ bnodeId, bnodePredicateMap, curie });
 * ```
 *
 * @category Graph
 * @since 0.18.0
 * @see {@link QuadBackedSchemaGraph}
 * @group Graph
 */
export type ResolveRestrictionOptionsType = {
  readonly 'bnodeId': string;
  readonly 'bnodePredicateMap': Map<string, QuadInterface[]> | undefined;
  readonly 'curie': CurieInterface;
};
