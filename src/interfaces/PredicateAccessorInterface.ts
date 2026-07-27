import type { SchemaCursorInterface } from './SchemaCursorInterface.js';

/**
 * Schema-level domain/range accessors for a predicate, each yielding a
 * {@link SchemaCursorInterface} over the class IRIs in that TBox role.
 *
 * @see {@link AboxGraphInterface.predicate}
 */
export interface PredicateAccessorInterface {
  domain(): SchemaCursorInterface;
  range(): SchemaCursorInterface;
}
