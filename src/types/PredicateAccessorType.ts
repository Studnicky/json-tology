import type { SchemaCursorInterface } from '../interfaces/SchemaCursorInterface.js';
import type { IdentityType } from './IdentityType.js';

/**
 * Schema-level domain/range accessors for a predicate, each yielding a
 * {@link SchemaCursorInterface} over the class IRIs in that TBox role.
 *
 * @remarks
 * Method-valued members returning a behavioral interface cannot be derived
 * from JSON Schema, so this is wrapped in {@link IdentityType} rather than
 * expressed as a schema-inferred type.
 *
 * @see {@link AboxGraphInterface.predicate}
 */
export type PredicateAccessorType = IdentityType<{
  domain(): SchemaCursorInterface;
  range(): SchemaCursorInterface;
}>;
