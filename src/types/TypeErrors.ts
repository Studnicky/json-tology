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
 * 1. **Validator-result interfaces** (Cluster B — `RequiredKeyNotInProperties`,
 *    `DependentRequiredKeyNotInProperties`, `IfDiscriminatorNotInProperties`).
 *    Returned from `ValidateSchemaType<T>` to surface schema-level cross-keyword
 *    violations. Carry a `kind` discriminant plus structured payload.
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
// Validator-result interfaces (Cluster B)
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
