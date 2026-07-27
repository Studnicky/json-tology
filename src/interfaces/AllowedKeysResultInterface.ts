/**
 * Allowed-key sets and property-alias map compiled from a schema node.
 *
 * @remarks
 * Used by the object validator to enforce `additionalProperties` and
 * `unevaluatedProperties` constraints and to apply property aliases.
 * `allowedKeys` is the full set of keys permitted (including inherited and
 * conditional); `allowedKeysForStrip` is the subset used when `stripUnknown`
 * is enabled; `propertyAliases` maps alias names to their canonical property
 * names for normalisation.
 *
 * @example
 * ```ts
 * const keys: AllowedKeysResultInterface = {
 *   allowedKeys: new Set(['id', 'name']),
 *   allowedKeysForStrip: new Set(['id', 'name']),
 *   propertyAliases: new Map([['userId', 'id']]),
 * };
 * ```
 *
 * @category Validation
 * @since 0.1.0
 * @see {@link InheritedPropertyKeySetInterface}
 * @group Validation
 */
export interface AllowedKeysResultInterface {
  'allowedKeys': Set<string> | undefined;
  'allowedKeysForStrip': Set<string> | undefined;
  'propertyAliases': Map<string, string>;
}
