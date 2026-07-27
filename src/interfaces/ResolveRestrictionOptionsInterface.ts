import type { CurieInterface } from './CurieInterface.js';
import type { QuadInterface } from './QuadInterface.js';
import type { StringValueEntity } from '../entities/StringValueEntity.js';

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
export interface ResolveRestrictionOptionsInterface {
  'bnodeId': StringValueEntity.Type;
  'bnodePredicateMap': Map<string, QuadInterface[]> | undefined;
  'curie': CurieInterface;
}
