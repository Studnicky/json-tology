/**
 * Type Configuration
 *
 * Module-augmentation interface that controls compile-time constraint branding.
 * All categories are enabled by default. Users disable per-category by declaring
 * a `.d.ts` file in their project:
 *
 * @example
 * ```ts
 * // json-tology.d.ts
 * // Add this augmentation in your project's .d.ts file:
 * interface JsonTologyTypeConfigInterface {
 *   formatBrands: false;   // disable format brands
 *   numericBrands: false;  // disable numeric brands
 * }
 * ```
 */

export interface JsonTologyTypeConfigInterface {
  /** Brand arrays with uniqueItems and contains. */
  'arrayBrands': true;
  /** Master switch. When false, disables all brands. */
  'brands': true;
  /** Brand strings with contentMediaType, contentEncoding. */
  'contentBrands': true;
  /** Brand strings and numbers with format. */
  'formatBrands': true;
  /** Brand schemas with $id and $schema dialect. */
  'nominalBrands': true;
  /** Brand numbers with minimum, maximum, exclusiveMinimum, exclusiveMaximum, multipleOf. */
  'numericBrands': true;
  /** Brand objects with minProperties, maxProperties. Flag excess properties when additionalProperties is false. */
  'objectBrands': true;
  /** Brand strings with minLength, maxLength, pattern. */
  'stringBrands': true;
  /**
   * Narrow strings with tiny `minLength` / `maxLength` bounds (<= 8) into
   * length-N character template literal types (`\`${string}${string}...\``).
   * Disabled by default - opt-in because tight length narrowing can slow
   * the type-checker on large schema fixtures. Opt in by augmenting:
   *
   * @example
   * ```ts
   * declare module 'json-tology/types' {
   *   interface JsonTologyTypeConfigInterface { 'tightStringLengths': true }
   * }
   * ```
   */
  'tightStringLengths': false;
}

/**
 * Check whether a brand category is enabled, respecting the master switch.
 *
 * Default-on flags resolve to `true` unless the interface declares `false`
 * (or the master `brands: false` switch is set). The `tightStringLengths`
 * flag is default-off - it resolves to `true` only when explicitly set to
 * `true` via module augmentation.
 */
export type IsEnabledType<K extends keyof JsonTologyTypeConfigInterface>
  = JsonTologyTypeConfigInterface['brands'] extends false ? false
    : K extends 'tightStringLengths'
      ? JsonTologyTypeConfigInterface[K] extends true ? true : false
      : JsonTologyTypeConfigInterface[K] extends false ? false
        : true;
