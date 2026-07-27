import type { RestrictionReferenceEntity } from '../entities/RestrictionReferenceEntity.js';

/**
 * Restriction — opaque type produced by `Compose.someValuesFrom`,
 * `Compose.allValuesFrom`, `Compose.hasValue`, `Compose.cardinality`,
 * `Compose.minimumCardinality`, and `Compose.maximumCardinality`.
 *
 * Carries enough information for the OWL TBox projection to emit an
 * anonymous `owl:Restriction` class (`_:b{n} rdf:type owl:Restriction;
 * owl:onProperty <prop>; owl:<predicate> <value>`) when the restriction
 * is composed via `Compose.subClassOf(restriction, body)`.
 *
 * The phantom-tagged shape (`'~jt:restriction'`) is internal and not
 * intended for direct authoring — the only valid producers are the
 * `Compose.*` factory methods.
 */

/**
 * Type guard — narrows an unknown value to a {@link RestrictionReferenceEntity.Type}.
 *
 * @remarks
 * Checks that `value` is a non-null object containing the phantom key
 * `'~jt:restriction'`. Does not validate the descriptor payload; use this
 * guard at runtime boundaries where any `unknown` value may arrive and needs
 * to be narrowed before the descriptor fields are accessed.
 *
 * @example
 * ```ts
 * if (RestrictionGuards.isRestrictionReference(candidate)) {
 *   const kind = candidate['~jt:restriction'].kind;
 * }
 * ```
 *
 * @category Schema Utilities
 * @since 0.10.0
 * @see {@link RestrictionReferenceEntity.Type}
 * @group Schema Utilities
 *
 * @param value - The value to test.
 * @returns `true` when `value` satisfies the {@link RestrictionReferenceEntity.Type} shape.
 */
export class RestrictionGuards {
  static isRestrictionReference(value: unknown): value is RestrictionReferenceEntity.Type {
    return (
      typeof value === 'object'
      && value !== null
      && '~jt:restriction' in value
    );
  }
}
