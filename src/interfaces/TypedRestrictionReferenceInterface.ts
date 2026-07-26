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
 * @remarks
 * Deliberate lint exception (`@studnicky/interface-must-be-contract`): the sole
 * member's shape is built entirely from the generic literal parameters
 * `TKind`/`TProp`/`TValue`, which is the entire point of this type — it exists
 * to carry compile-time literal narrowing into `InferType`-derived property
 * types. Extracting the member to a schema-derived entity (as the sibling,
 * non-generic {@link RestrictionReferenceEntity} does with
 * `RestrictionDescriptorEntity.Type`) would erase that narrowing and defeat
 * the type's purpose. JSON Schema entities cannot carry generic type
 * parameters, so no schema-derived remedy exists for this shape.
 */
export interface TypedRestrictionReferenceInterface<
  TKind extends RestrictionKindEntity.Type,
  TProp extends string,
  TValue extends boolean | number | string
> {
  '~jt:restriction': {
    'kind': TKind;
    'onProperty': TProp;
    'value': TValue;
  };
}
