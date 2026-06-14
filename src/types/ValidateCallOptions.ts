/**
 * Per-call option overrides for {@link SchemaRegistryInterface.validate}.
 */
export type ValidateCallOptionsType = {
  /**
   * When `true`, default values declared in the schema are applied to the
   * data before validation runs. A required property with a declared
   * `default` will be populated and the validation will pass.
   *
   * When `false` or omitted, the data is validated as-is — missing required
   * properties are reported as errors even when the schema declares a default.
   *
   * @default false
   */
  'enableDefaults'?: boolean;
};
