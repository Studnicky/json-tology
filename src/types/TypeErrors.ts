/**
 * Type-level diagnostic brands.
 *
 * When a compile-time validation rule fails, json-tology builders resolve to a
 * named brand type carrying the offending value(s) instead of plain `never`.
 * IDE hovers then surface the actionable diagnostic (the constraint name + the
 * offending key, id, etc.) instead of a generic "Argument of type X is not
 * assignable to parameter of type never" message.
 *
 * Two patterns are used in this file:
 *
 * 1. **Validator-result interfaces** (Clusters B, D, E — `RequiredKeyNotInProperties`,
 *    `DependentRequiredKeyNotInProperties`, `IfDiscriminatorNotInProperties`,
 *    `ChainMismatch`, `ChainSchemaMismatch`, `DuplicateSchemaId`,
 *    `RefNotFound`, `AnchorNotFound`).
 *    Returned from cluster validators to surface schema-level / chain-level
 *    cross-keyword violations. Carry a `kind` discriminant plus structured
 *    payload.
 *
 * 2. **Constraint brands intersected with `never`** (Cluster A —
 *    `SelfSubClassType`, `DiscriminatorMissingType`, `SelfEquivalentType`,
 *    `IntersectionIdCollisionType`). Used as compose-builder argument
 *    constraints — the brand intersected with `never` keeps the type
 *    assignment-incompatible while preserving the descriptive shape for IDE
 *    hover.
 *
 * Both patterns coexist; pick whichever fits the call site (validator output
 * vs. parameter constraint).
 */

// ---------------------------------------------------------------------------
// Validator-result interfaces (Clusters B, D, E)
// ---------------------------------------------------------------------------

/**
 * Emitted when a `dependentRequired` map key — or one of the entries of one of
 * its arrays — is not a key of `properties`.
 *
 * @remarks
 * Surfaces as the inferred type of the schema builder return value so IDE
 * hovers name the offending key rather than showing a generic `never`.
 *
 * @example
 * ```ts
 * // Schema with a dependentRequired key not in properties → inferred type
 * // includes DependentRequiredKeyNotInPropertiesType<'missingKey'>.
 * ```
 *
 * @category Type Errors
 * @since 0.18.0
 * @see {@link RequiredKeyNotInPropertiesType}
 * @group Type Errors
 *
 * @typeParam TKey - The offending key (either the map key or a dependency entry).
 */
export type DependentRequiredKeyNotInPropertiesType<TKey extends string> = {
  readonly 'invalidKey': TKey;
  readonly 'kind': 'DependentRequiredKeyNotInProperties';
};

/**
 * Emitted when an `if.properties` discriminator key is not a key of the parent
 * schema's `properties`.
 *
 * @remarks
 * Surfaces as the inferred type of the schema builder return value so IDE
 * hovers identify the missing property rather than a generic `never`.
 *
 * @example
 * ```ts
 * // Schema whose if.properties references a key not in properties →
 * // inferred type includes IfDiscriminatorNotInPropertiesType<'missingKey'>.
 * ```
 *
 * @category Type Errors
 * @since 0.18.0
 * @see {@link RequiredKeyNotInPropertiesType}
 * @group Type Errors
 *
 * @typeParam TKey - The offending discriminator property name.
 */
export type IfDiscriminatorNotInPropertiesType<TKey extends string> = {
  readonly 'invalidKey': TKey;
  readonly 'kind': 'IfDiscriminatorNotInProperties';
};

/**
 * Emitted when a `required` array entry is not a key of `properties`.
 *
 * @remarks
 * Surfaces as the inferred type of the schema builder return value. The brand
 * carries both the offending key and the set of valid keys so an IDE hover
 * can show the author exactly which keys are available.
 *
 * @example
 * ```ts
 * // Schema with required: ['missing'] but properties: { name: ... } →
 * // inferred type includes RequiredKeyNotInPropertiesType<'missing', 'name'>.
 * ```
 *
 * @category Type Errors
 * @since 0.18.0
 * @see {@link DependentRequiredKeyNotInPropertiesType}
 * @group Type Errors
 *
 * @typeParam TKey - The offending entry from the `required` array.
 * @typeParam TActual - The union of valid `keyof properties` values.
 */
export type RequiredKeyNotInPropertiesType<
  TKey extends string,
  TActual extends string
> = {
  readonly 'actualPropertyKeys': TActual;
  readonly 'invalidKey': TKey;
  readonly 'kind': 'RequiredKeyNotInProperties';
};

/**
 * Emitted when a `JsonTology.create({ schemas: [...] })` tuple contains two
 * schemas with the same `$id`. The brand attaches to the offending tuple
 * slots via `UniqueSchemaIdsType`, surfacing the duplicated IRI by name in
 * editor diagnostics.
 *
 * @remarks
 * The brand is placed on both conflicting tuple positions so the author can
 * see the collision in the hover for each schema literal, not just a generic
 * "argument not assignable" error.
 *
 * @example
 * ```ts
 * // JsonTology.create({ schemas: [SchemaA, SchemaA] }) →
 * // inferred type includes DuplicateSchemaIdType<'https://example.com/A'>.
 * ```
 *
 * @category Type Errors
 * @since 0.18.0
 * @see {@link RefNotFoundType}
 * @group Type Errors
 *
 * @typeParam TId - The duplicated `$id` IRI literal.
 */
export type DuplicateSchemaIdType<TId extends string> = {
  readonly 'duplicateId': TId;
  readonly 'kind': 'DuplicateSchemaId';
};

/**
 * Emitted when an absolute `$ref` IRI is not present in the schema
 * references map currently in scope. Surfaces in `InferType<S, TReferences>`
 * when `S` references an `$id` the registry has not seen.
 *
 * @remarks
 * When the references map is non-empty (i.e. `HasReferencesType` is `true`),
 * a missing ref becomes this brand rather than `unknown`, making the error
 * visible at compile time.
 *
 * @example
 * ```ts
 * // InferType<{ $ref: 'https://missing.example/' }, { 'https://other/': ... }>
 * // → RefNotFoundType<'https://missing.example/'>
 * ```
 *
 * @category Type Errors
 * @since 0.18.0
 * @see {@link AnchorNotFoundType}
 * @group Type Errors
 *
 * @typeParam TRef - The unresolved `$ref` IRI literal.
 */
export type RefNotFoundType<TRef extends string> = {
  readonly 'kind': 'RefNotFound';
  readonly 'unresolvedRef': TRef;
};

/**
 * Emitted when a cross-schema fragment ref of the form `<base>#<anchor>`
 * resolves to a schema that does not declare a matching `$anchor` (or the
 * JSON pointer fragment lands outside the schema graph).
 *
 * @remarks
 * Like `RefNotFoundType`, this brand only appears when the references
 * map is non-empty; otherwise the type falls back to `unknown` to preserve
 * usability in permissive contexts.
 *
 * @example
 * ```ts
 * // { $ref: 'https://example.com/Foo#missingAnchor' } with a references map
 * // that has 'https://example.com/Foo' but no '#missingAnchor' →
 * // AnchorNotFoundType<'https://example.com/Foo', 'missingAnchor'>
 * ```
 *
 * @category Type Errors
 * @since 0.18.0
 * @see {@link RefNotFoundType}
 * @group Type Errors
 *
 * @typeParam TBase - The base IRI portion of the ref.
 * @typeParam TAnchor - The anchor or pointer fragment that could not be resolved.
 */
export type AnchorNotFoundType<
  TBase extends string,
  TAnchor extends string
> = {
  readonly 'inSchema': TBase;
  readonly 'kind': 'AnchorNotFound';
  readonly 'unresolvedAnchor': TAnchor;
};

/**
 * Emitted when a `Transform.chain` stage's decoded output type does not match
 * the next stage's decoded input type. The chain is broken at `stageIndex`,
 * which produced `producedByPriorStage` while the next stage expected
 * `expectedByThisStage`.
 *
 * @remarks
 * The brand is surfaced as the return type of `Transform.chain` so the author
 * sees the exact stage index and both types in the IDE hover rather than a
 * generic assignment error.
 *
 * @example
 * ```ts
 * // Transform.chain([stageA, stageB]) where stageA produces string but
 * // stageB expects number → ChainMismatchType<0, string, number>
 * ```
 *
 * @category Type Errors
 * @since 0.18.0
 * @see {@link ChainSchemaMismatchType}
 * @group Type Errors
 *
 * @typeParam TStageIndex - Zero-based index of the producing stage.
 * @typeParam TProduced - Decoded output type of the producing stage.
 * @typeParam TExpected - Decoded input type expected by the consuming stage.
 */
export type ChainMismatchType<
  TStageIndex extends number,
  TProduced,
  TExpected
> = {
  readonly 'expectedByThisStage': TExpected;
  readonly 'kind': 'ChainMismatch';
  readonly 'producedByPriorStage': TProduced;
  readonly 'stageIndex': TStageIndex;
};

/**
 * Emitted when a `Transform.chain`'s last stage decoded output type does not
 * match the schema's canonical type. A normalize chain must terminate in the
 * schema-conforming form; otherwise the post-decode validation would reject it.
 *
 * @remarks
 * Surfaces as the return type of `Transform.chain` when the final stage does
 * not produce the schema's canonical type, so the author sees both types in
 * the hover.
 *
 * @example
 * ```ts
 * // Transform.chain(StringSchema, [stage]) where the schema's canonical type
 * // is string but the last stage produces number →
 * // ChainSchemaMismatchType<string, number>
 * ```
 *
 * @category Type Errors
 * @since 0.18.0
 * @see {@link ChainMismatchType}
 * @group Type Errors
 *
 * @typeParam TCanonical - Canonical type inferred from the schema (required tail output).
 * @typeParam TLastStageOut - Decoded output type produced by the chain's last stage.
 */
export type ChainSchemaMismatchType<
  TCanonical,
  TLastStageOut
> = {
  readonly 'kind': 'ChainSchemaMismatch';
  readonly 'lastStageDecodeOutput': TLastStageOut;
  readonly 'schemaCanonicalType': TCanonical;
};

/**
 * True when a references map is present (has at least one key).
 *
 * @remarks
 * Used throughout `InferSchemaType` to decide whether unresolved refs should
 * surface as diagnostic brands (`RefNotFoundType`, `AnchorNotFoundType`)
 * or silently fall back to `unknown`. The distinction exists so consumers who
 * do not provide a references map are not flooded with errors.
 *
 * @example
 * ```ts
 * type A = HasReferencesType<Record<never, never>>;  // false
 * type B = HasReferencesType<{ 'https://example.com/': unknown }>;  // true
 * ```
 *
 * @category Type Errors
 * @since 0.18.0
 * @see {@link RefNotFoundType}
 * @group Type Errors
 *
 * @typeParam TReferences - The references map type to test.
 */
export type HasReferencesType<TReferences>
  = [keyof TReferences] extends [never] ? false : true;

// ---------------------------------------------------------------------------
// Constraint brands intersected with `never` (Cluster A)
// ---------------------------------------------------------------------------

declare const TYPE_ERROR_TAG: unique symbol;

type TypeErrorBrandType<TName extends string> = {
  readonly [TYPE_ERROR_TAG]: TName;
};

/**
 * Compose.subClassOf body's $id collides with the parent's $id.
 *
 * @remarks
 * This constraint brand is intersected with `never` so the builder return
 * type is assignment-incompatible while still surfacing the colliding IRI in
 * the IDE hover via the `collidingId` field.
 *
 * @example
 * ```ts
 * // Compose.subClassOf(parent, { $id: parent.$id, ... }) →
 * // SelfSubClassType<'https://example.com/Parent'>
 * ```
 *
 * @category Type Errors
 * @since 0.18.0
 * @see {@link SelfEquivalentType}
 * @group Type Errors
 *
 * @typeParam TId - The `$id` IRI that collides with the parent's identifier.
 */
export type SelfSubClassType<TId extends string> = never & TypeErrorBrandType<'SelfSubClass'> & {
  readonly 'collidingId': TId;
};

/**
 * Compose.discriminatedUnion variant is missing a const discriminator on `prop`.
 *
 * @remarks
 * Surfaces when a `Compose.discriminatedUnion` variant does not declare
 * `{ properties: { [prop]: { const: '...' } } }`. The brand names both the
 * expected discriminator property and the offending variant schema.
 *
 * @example
 * ```ts
 * // Compose.discriminatedUnion('kind', [variantWithoutConst]) →
 * // DiscriminatorMissingType<'kind', typeof variantWithoutConst>
 * ```
 *
 * @category Type Errors
 * @since 0.18.0
 * @see {@link SelfSubClassType}
 * @group Type Errors
 *
 * @typeParam TProp - The discriminator property name.
 * @typeParam TVariant - The variant schema that is missing the const discriminator.
 */
export type DiscriminatorMissingType<
  TProp extends string,
  TVariant
> = never & TypeErrorBrandType<'DiscriminatorMissing'> & {
  readonly 'discriminator': TProp;
  readonly 'variant': TVariant;
};

/**
 * Compose.equivalent options.$id collides with source.$id.
 *
 * @remarks
 * Intersected with `never` to make the builder return type
 * assignment-incompatible. The `collidingId` field names the duplicate IRI
 * in the IDE hover.
 *
 * @example
 * ```ts
 * // Compose.equivalent(source, { $id: source.$id }) →
 * // SelfEquivalentType<'https://example.com/Source'>
 * ```
 *
 * @category Type Errors
 * @since 0.18.0
 * @see {@link SelfSubClassType}
 * @group Type Errors
 *
 * @typeParam TId - The `$id` IRI that collides with the source schema's identifier.
 */
export type SelfEquivalentType<TId extends string> = never & TypeErrorBrandType<'SelfEquivalent'> & {
  readonly 'collidingId': TId;
};

/**
 * Compose.intersection newId collides with one of the input schemas' $ids.
 *
 * @remarks
 * Prevents accidental identity confusion when the new intersection schema's
 * `$id` duplicates one of the input schemas. Intersected with `never` and
 * carries the colliding IRI for actionable hover text.
 *
 * @example
 * ```ts
 * // Compose.intersection('https://example.com/A', [schemaA, schemaB]) →
 * // IntersectionIdCollisionType<'https://example.com/A'>
 * ```
 *
 * @category Type Errors
 * @since 0.18.0
 * @see {@link SelfSubClassType}
 * @group Type Errors
 *
 * @typeParam TId - The `$id` IRI that collides with one of the input schemas.
 */
export type IntersectionIdCollisionType<TId extends string> = never & TypeErrorBrandType<'IntersectionIdCollision'> & {
  readonly 'collidingId': TId;
};

// ---------------------------------------------------------------------------
// OWL 2 property-characteristic conflict brands (Cluster F)
// ---------------------------------------------------------------------------

/**
 * Emitted when two or more OWL 2 property characteristics that are logically
 * incompatible are set to `true` on the same property schema.
 *
 * Hard-conflict pairs (forbidden by OWL 2 semantics):
 *   - `symmetric` + `asymmetric`  — mutually exclusive by definition
 *   - `reflexive`  + `irreflexive` — mutually exclusive by definition
 *   - `asymmetric` + `reflexive`   — asymmetric implies irreflexive in OWL 2;
 *                                    explicit reflexive contradicts that
 *
 * @remarks
 * Surfaced as a `schemaErrors` field on the enclosing schema so
 * `ValidatePropertyCharacteristicsType` can propagate the conflict to the
 * author's call site and the IDE hover names the property and conflicting
 * characteristics.
 *
 * @example
 * ```ts
 * // Property with both symmetric: true and asymmetric: true →
 * // PropertyCharacteristicConflictType<'myProp', readonly ['symmetric', 'asymmetric']>
 * ```
 *
 * @category Type Errors
 * @since 0.18.0
 * @see {@link CheckPropertyCharacteristicsType}
 * @group Type Errors
 *
 * @typeParam TProperty - The property name where the conflict was detected.
 * @typeParam TConflicts - Tuple of the conflicting characteristic names.
 */
export type PropertyCharacteristicConflictType<
  TProperty extends string,
  TConflicts extends readonly string[]
> = {
  readonly 'conflicts': TConflicts;
  readonly 'kind': 'PropertyCharacteristicConflict';
  readonly 'property': TProperty;
};

/**
 * Check a single property schema for conflicting OWL 2 characteristics.
 *
 * Returns `never` when there are no conflicts; returns a
 * `PropertyCharacteristicConflictType` brand when a hard conflict is
 * detected. The brand is surfaced as a `schemaErrors` field on the enclosing
 * schema so `ValidateSchemaType` (and `ValidatePropertyCharacteristicsType`)
 * can propagate the incompatibility to the author's call site.
 *
 * @remarks
 * Evaluated per-property by `PropertyCharacteristicErrorsType`. The result
 * is `never` (no-op intersection) when no conflict exists, or a named brand
 * when a hard OWL 2 axiom is violated.
 *
 * @example
 * ```ts
 * type R = CheckPropertyCharacteristicsType<'myProp', { symmetric: true; asymmetric: true }>;
 * // → PropertyCharacteristicConflictType<'myProp', readonly ['symmetric', 'asymmetric']>
 * ```
 *
 * @category Type Errors
 * @since 0.18.0
 * @see {@link PropertyCharacteristicConflictType}
 * @group Type Errors
 *
 * @typeParam TName - The property name (for the brand payload).
 * @typeParam TProp - The property schema object.
 */
export type CheckPropertyCharacteristicsType<TName extends string, TProp>
  = TProp extends { readonly 'asymmetric': true;
    readonly 'symmetric': true; }
    ? PropertyCharacteristicConflictType<TName, readonly ['symmetric', 'asymmetric']>
    : TProp extends { readonly 'irreflexive': true;
      readonly 'reflexive': true; }
      ? PropertyCharacteristicConflictType<TName, readonly ['reflexive', 'irreflexive']>
      : TProp extends { readonly 'asymmetric': true;
        readonly 'reflexive': true }
        ? PropertyCharacteristicConflictType<TName, readonly ['asymmetric', 'reflexive']>
        : never;

/**
 * Walk every entry of a `properties` map and collect all characteristic
 * conflicts into a union. Returns `never` when all properties are sound.
 *
 * @remarks
 * Distributes `CheckPropertyCharacteristicsType` over every key of `TProps`
 * and unions the results. The `never` members are absorbed by the union, so
 * a conflict-free schema resolves to `never` overall.
 *
 * @example
 * ```ts
 * type R = PropertyCharacteristicErrorsType<{
 *   a: { symmetric: true; asymmetric: true };
 *   b: { transitive: true };
 * }>;
 * // → PropertyCharacteristicConflictType<'a', readonly ['symmetric', 'asymmetric']>
 * ```
 *
 * @category Type Errors
 * @since 0.18.0
 * @see {@link CheckPropertyCharacteristicsType}
 * @group Type Errors
 *
 * @typeParam TProps - The `properties` record from a schema.
 */
export type PropertyCharacteristicErrorsType<TProps>
  = {
    [K in Extract<keyof TProps, string>]: CheckPropertyCharacteristicsType<K, TProps[K]>;
  }[Extract<keyof TProps, string>];

/**
 * Validate a schema's `properties` map for OWL 2 characteristic conflicts.
 *
 * Pass `T` through if every property is conflict-free; otherwise intersect `T`
 * with `{ readonly 'schemaErrors': <brand union> }` so the literal is
 * incompatible with `ValidateSchemaType`'s expected shape and the IDE hover
 * surfaces the conflict details.
 *
 * @remarks
 * This is the top-level entry point used by schema builder call sites. It
 * delegates conflict detection to `PropertyCharacteristicErrorsType` and
 * attaches any errors as a `schemaErrors` field so a single hover shows all
 * OWL 2 violations at once.
 *
 * @example
 * ```ts
 * type R = ValidatePropertyCharacteristicsType<{
 *   properties: { p: { symmetric: true; asymmetric: true } }
 * }>;
 * // T & { schemaErrors: PropertyCharacteristicConflictType<...> }
 * ```
 *
 * @category Type Errors
 * @since 0.18.0
 * @see {@link PropertyCharacteristicErrorsType}
 * @group Type Errors
 *
 * @typeParam T - The full schema object to validate.
 */
export type ValidatePropertyCharacteristicsType<T>
  = T extends { readonly 'properties': infer TProps }
    ? [PropertyCharacteristicErrorsType<TProps>] extends [never]
      ? T
      : T & { readonly 'schemaErrors': PropertyCharacteristicErrorsType<TProps> }
    : T;
