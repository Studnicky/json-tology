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

/**
 * Discriminant literal union for OWL 2 property restriction kinds.
 *
 * @remarks
 * Each member corresponds to an OWL 2 property restriction axiom keyword:
 * `allValuesFrom` (universal), `someValuesFrom` (existential), `hasValue`
 * (individual or literal), `cardinality` (exact), `minCardinality`, and
 * `maxCardinality`. Used as the `kind` discriminant on
 * {@link RestrictionDescriptorType}.
 *
 * @example
 * ```ts
 * const kind: RestrictionKindType = 'someValuesFrom';
 * ```
 *
 * @category Schema Utilities
 * @since 0.10.0
 * @see {@link RestrictionDescriptorType}
 * @group Schema Utilities
 */
export type RestrictionKindType
  = | 'allValuesFrom'
  | 'cardinality'
  | 'hasValue'
  | 'maxCardinality'
  | 'minCardinality'
  | 'someValuesFrom';

/**
 * Descriptor payload embedded inside a {@link RestrictionRefType} phantom tag.
 *
 * @remarks
 * Carries the three fields that fully describe an OWL 2 property restriction:
 * the restriction `kind` (which OWL axiom to emit), the `onProperty` IRI, and
 * the `value` (class IRI, individual IRI, or literal). Produced exclusively by
 * the `Compose.*` restriction factory methods; consumers should not construct
 * this shape directly.
 *
 * @example
 * ```ts
 * const descriptor: RestrictionDescriptorType = {
 *   kind: 'hasValue',
 *   onProperty: 'https://schema.org/color',
 *   value: 'red',
 * };
 * ```
 *
 * @category Schema Utilities
 * @since 0.10.0
 * @see {@link RestrictionRefType}
 * @group Schema Utilities
 */
export interface RestrictionDescriptorType {
  readonly 'kind': RestrictionKindType;
  readonly 'onProperty': string;
  readonly 'value': boolean | number | string;
}

/**
 * Phantom-tagged wrapper that marks a schema as carrying an OWL 2 restriction.
 *
 * @remarks
 * The `'~jt:restriction'` key is a compile-time-only phantom tag. The only
 * valid producers are the `Compose.*` restriction factory methods
 * (`Compose.someValuesFrom`, `Compose.allValuesFrom`, `Compose.hasValue`,
 * `Compose.cardinality`, `Compose.minCardinality`, `Compose.maxCardinality`).
 * The OWL TBox projection reads this tag to emit an anonymous
 * `owl:Restriction` blank node when the restriction is composed via
 * `Compose.subClassOf(restriction, body)`.
 *
 * @example
 * ```ts
 * const ref: RestrictionRefType = Compose.hasValue('https://schema.org/color', 'red');
 * ```
 *
 * @category Schema Utilities
 * @since 0.10.0
 * @see {@link TypedRestrictionRefType}
 * @group Schema Utilities
 */
export type RestrictionRefType = Readonly<Record<'~jt:restriction', RestrictionDescriptorType>>;

/**
 * Typed variant of {@link RestrictionRefType} that preserves the specific
 * `kind`, `onProperty`, and `value` as literal-type parameters.
 *
 * @remarks
 * Produced by the restriction factory methods (`Compose.hasValue`,
 * `Compose.cardinality`, etc.) so that `Compose.subClassOf(restriction, body)`
 * can propagate the restriction descriptor into the body's `jt:restrictions`
 * type as a concrete tuple entry, enabling compile-time property narrowing on
 * `InferType`-derived types.
 *
 * @example
 * ```ts
 * type R = TypedRestrictionRefType<'hasValue', 'https://schema.org/color', 'red'>;
 * ```
 *
 * @category Schema Utilities
 * @since 0.10.0
 * @see {@link RestrictionRefType}
 * @group Schema Utilities
 *
 * @typeParam TKind - The specific OWL restriction kind (discriminant literal).
 * @typeParam TProp - The `onProperty` IRI as a string literal.
 * @typeParam TValue - The restriction value as a boolean, number, or string literal.
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
 * Type guard — narrows an unknown value to a {@link RestrictionRefType}.
 *
 * @remarks
 * Checks that `value` is a non-null object containing the phantom key
 * `'~jt:restriction'`. Does not validate the descriptor payload; use this
 * guard at runtime boundaries where any `unknown` value may arrive and needs
 * to be narrowed before the descriptor fields are accessed.
 *
 * @example
 * ```ts
 * if (isRestrictionRef(candidate)) {
 *   const kind = candidate['~jt:restriction'].kind;
 * }
 * ```
 *
 * @category Schema Utilities
 * @since 0.10.0
 * @see {@link RestrictionRefType}
 * @group Schema Utilities
 *
 * @param value - The value to test.
 * @returns `true` when `value` satisfies the {@link RestrictionRefType} shape.
 */
export function isRestrictionRef(value: unknown): value is RestrictionRefType {
  return (
    typeof value === 'object'
    && value !== null
    && '~jt:restriction' in value
  );
}
