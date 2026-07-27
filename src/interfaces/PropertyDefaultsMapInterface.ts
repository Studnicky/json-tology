/**
 * A map from property name to its default value descriptor.
 *
 * @remarks
 * Built once per object schema node. Each entry carries `hasDefault` (whether
 * a schema-declared default exists) and `defaultValue` (the default value).
 * When `applyDefaults` is enabled the engine iterates this map to fill missing
 * properties before further validation.
 *
 * @category Validation
 * @since 0.1.0
 */
export interface PropertyDefaultsMapInterface extends Map<string, { 'defaultValue': unknown;
  'hasDefault': boolean; }> {}
