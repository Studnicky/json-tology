/**
 * Type-level error brands.
 *
 * These types exist purely at the type level to surface compile-time validation
 * failures with structured, IDE-hoverable diagnostics. When a schema fails a
 * cross-keyword check, `ValidateSchemaType` resolves to one of these branded
 * error types instead of `never`, so authors see why the schema was rejected.
 *
 * Each brand carries a `kind` discriminant plus structured payload fields
 * describing the offending key and the available alternatives.
 */

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
