import type { RestrictionKindEntity } from '../entities/RestrictionKindEntity.js';

/**
 * Typed variant of {@link RestrictionReferenceEntity} that preserves the specific
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
 * type R = TypedRestrictionReferenceInterface<'hasValue', 'https://schema.org/color', 'red'>;
 * ```
 *
 * @category Schema Utilities
 * @since 0.10.0
 * @see {@link RestrictionReferenceEntity}
 * @group Schema Utilities
 *
 * @typeParam TKind - The specific OWL restriction kind (discriminant literal).
 * @typeParam TProp - The `onProperty` IRI as a string literal.
 * @typeParam TValue - The restriction value as a boolean, number, or string literal.
 *
 * Carries a `unique symbol` brand member alongside the data member so it has real
 * contract evidence (per `@studnicky/interface-must-be-contract`) without disturbing
 * the generic literal narrowing that is the entire point of this type — extracting
 * the data member to a schema-derived entity, as the sibling, non-generic
 * {@link RestrictionReferenceEntity} does, would erase that narrowing. The shape
 * is instead named via {@link TypedRestrictionShapeInterface} so no member is an
 * inline object-type literal.
 */
interface TypedRestrictionShapeInterface<
  TKind extends RestrictionKindEntity.Type,
  TProp extends string,
  TValue extends boolean | number | string
> {
  'kind': TKind;
  'onProperty': TProp;
  readonly 'typedRestrictionShapeBrand'?: unique symbol;
  'value': TValue;
}

export interface TypedRestrictionReferenceInterface<
  TKind extends RestrictionKindEntity.Type,
  TProp extends string,
  TValue extends boolean | number | string
> {
  readonly 'typedRestrictionReferenceBrand'?: unique symbol;
  '~jt:restriction': TypedRestrictionShapeInterface<TKind, TProp, TValue>;
}
