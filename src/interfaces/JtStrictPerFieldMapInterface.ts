/**
 * A map from property name to its `jtStrict` override flag.
 *
 * @remarks
 * When absent, strict-mode behaviour is determined by the top-level
 * `JtConfig.strict` option. When present, individual property entries override
 * that default, allowing fine-grained control over which fields must be
 * exactly typed.
 *
 * @category Validation
 * @since 0.1.0
 */
export interface JtStrictPerFieldMapInterface extends Map<string, boolean> {}
