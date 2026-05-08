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
 *    `PipeChainMismatch`, `PipeChainSchemaMismatch`, `DuplicateSchemaId`,
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
 * @template TKey The offending key (either the map key or a dependency entry).
 */
export interface DependentRequiredKeyNotInPropertiesInterface<TKey extends string> {
  readonly 'invalidKey': TKey;
  readonly 'kind': 'DependentRequiredKeyNotInProperties';
}

/**
 * Emitted when an `if.properties` discriminator key is not a key of the parent
 * schema's `properties`.
 *
 * @template TKey The offending discriminator property name.
 */
export interface IfDiscriminatorNotInPropertiesInterface<TKey extends string> {
  readonly 'invalidKey': TKey;
  readonly 'kind': 'IfDiscriminatorNotInProperties';
}

/**
 * Emitted when a `required` array entry is not a key of `properties`.
 *
 * @template TKey   The offending entry from the `required` array.
 * @template TActual The union of valid `keyof properties` values.
 */
export interface RequiredKeyNotInPropertiesInterface<
  TKey extends string,
  TActual extends string
> {
  readonly 'actualPropertyKeys': TActual;
  readonly 'invalidKey': TKey;
  readonly 'kind': 'RequiredKeyNotInProperties';
}

/**
 * Emitted when a `JsonTology.create({ schemas: [...] })` tuple contains two
 * schemas with the same `$id`. The brand attaches to the offending tuple
 * slots via `UniqueSchemaIdsType`, surfacing the duplicated IRI by name in
 * editor diagnostics.
 *
 * @template TId The duplicated `$id` IRI literal.
 */
export interface DuplicateSchemaIdInterface<TId extends string> {
  readonly 'duplicateId': TId;
  readonly 'kind': 'DuplicateSchemaId';
}

/**
 * Emitted when an absolute `$ref` IRI is not present in the schema
 * references map currently in scope. Surfaces in `InferType<S, TReferences>`
 * when `S` references an `$id` the registry has not seen.
 *
 * @template TRef The unresolved `$ref` IRI literal.
 */
export interface RefNotFoundInterface<TRef extends string> {
  readonly 'kind': 'RefNotFound';
  readonly 'unresolvedRef': TRef;
}

/**
 * Emitted when a cross-schema fragment ref of the form `<base>#<anchor>`
 * resolves to a schema that does not declare a matching `$anchor` (or the
 * JSON pointer fragment lands outside the schema graph).
 *
 * @template TBase   The base IRI portion of the ref.
 * @template TAnchor The anchor or pointer fragment that could not be resolved.
 */
export interface AnchorNotFoundInterface<
  TBase extends string,
  TAnchor extends string
> {
  readonly 'inSchema': TBase;
  readonly 'kind': 'AnchorNotFound';
  readonly 'unresolvedAnchor': TAnchor;
}

/**
 * Emitted when a `Transform.pipe` stage's decoded output type does not match
 * the next stage's decoded input type. The chain is broken at `stageIndex`,
 * which produced `producedByPriorStage` while the next stage expected
 * `expectedByThisStage`.
 *
 * @template TStageIndex Zero-based index of the producing stage.
 * @template TProduced   Decoded output type of the producing stage.
 * @template TExpected   Decoded input type expected by the consuming stage.
 */
export interface PipeChainMismatchInterface<
  TStageIndex extends number,
  TProduced,
  TExpected
> {
  readonly 'expectedByThisStage': TExpected;
  readonly 'kind': 'PipeChainMismatch';
  readonly 'producedByPriorStage': TProduced;
  readonly 'stageIndex': TStageIndex;
}

/**
 * Emitted when a `Transform.pipe` first stage's decoded input type does not
 * match the schema's wire-form type.
 *
 * @template TWire           Wire-form type inferred from the schema.
 * @template TFirstStageIn   Decoded input type of the first stage.
 */
export interface PipeChainSchemaMismatchInterface<
  TWire,
  TFirstStageIn
> {
  readonly 'firstStageDecodeInput': TFirstStageIn;
  readonly 'kind': 'PipeChainSchemaMismatch';
  readonly 'schemaWireType': TWire;
}

/** True when a references map is present (has at least one key). */
export type HasReferencesType<TReferences>
  = [keyof TReferences] extends [never] ? false : true;

// ---------------------------------------------------------------------------
// Constraint brands intersected with `never` (Cluster A)
// ---------------------------------------------------------------------------

declare const TYPE_ERROR_TAG: unique symbol;

interface TypeErrorBrandInterface<TName extends string> {
  readonly [TYPE_ERROR_TAG]: TName;
}

/** Compose.subClassOf body's $id collides with the parent's $id. */
export type SelfSubClassType<TId extends string> = never & TypeErrorBrandInterface<'SelfSubClass'> & {
  readonly 'collidingId': TId;
};

/** Compose.discriminatedUnion variant is missing a const discriminator on `prop`. */
export type DiscriminatorMissingType<
  TProp extends string,
  TVariant
> = never & TypeErrorBrandInterface<'DiscriminatorMissing'> & {
  readonly 'discriminator': TProp;
  readonly 'variant': TVariant;
};

/** Compose.equivalent options.$id collides with source.$id. */
export type SelfEquivalentType<TId extends string> = never & TypeErrorBrandInterface<'SelfEquivalent'> & {
  readonly 'collidingId': TId;
};

/** Compose.intersection newId collides with one of the input schemas' $ids. */
export type IntersectionIdCollisionType<TId extends string> = never & TypeErrorBrandInterface<'IntersectionIdCollision'> & {
  readonly 'collidingId': TId;
};
