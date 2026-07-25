import type { CurieInterface } from '../interfaces/CurieInterface.js';
import type { QuadInterface } from '../interfaces/QuadInterface.js';
import type { InferType } from './Schema.js';

export const RESOLVE_RESTRICTION_OPTIONS_DATA_SCHEMA = {
  'properties': { 'bnodeId': { 'type': 'string' } },
  'required': ['bnodeId'],
  'type': 'object'
} as const;

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
export type ResolveRestrictionOptionsType = InferType<typeof RESOLVE_RESTRICTION_OPTIONS_DATA_SCHEMA> & {
  'bnodePredicateMap': Map<string, QuadInterface[]> | undefined;
  'curie': CurieInterface;
};
