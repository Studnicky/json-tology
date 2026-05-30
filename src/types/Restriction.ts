/**
 * Restriction — opaque type produced by `Compose.someValuesFrom`,
 * `Compose.allValuesFrom`, `Compose.hasValue`, `Compose.cardinality`,
 * `Compose.minCardinality`, and `Compose.maxCardinality`.
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

export type RestrictionKindType
  = | 'allValuesFrom'
  | 'cardinality'
  | 'hasValue'
  | 'maxCardinality'
  | 'minCardinality'
  | 'someValuesFrom';

export interface RestrictionDescriptorType {
  readonly 'kind': RestrictionKindType;
  readonly 'onProperty': string;
  readonly 'value': boolean | number | string;
}

export type RestrictionRefType = Readonly<Record<'~jt:restriction', RestrictionDescriptorType>>;

/**
 * Typed variant of `RestrictionRefType` that carries the specific
 * `kind`, `onProperty`, and `value` as literal-type parameters. Produced by
 * the restriction factory methods (`Compose.hasValue`, `Compose.cardinality`,
 * etc.) so that `Compose.subClassOf(restriction, body)` can propagate
 * the restriction descriptor into the body's `jt:restrictions` type.
 */
export type TypedRestrictionRefType<
  TKind extends RestrictionKindType,
  TProp extends string,
  TValue extends boolean | number | string
> = Readonly<Record<'~jt:restriction', {
  readonly 'kind': TKind;
  readonly 'onProperty': TProp;
  readonly 'value': TValue;
}>>;

export { RESTRICTION_TAG } from '../constants/RESTRICTION.js';

/**
 * Type guard — narrows an unknown value to a `RestrictionRefType`.
 */
export function isRestrictionRef(value: unknown): value is RestrictionRefType {
  return (
    typeof value === 'object'
    && value !== null
    && '~jt:restriction' in value
  );
}
