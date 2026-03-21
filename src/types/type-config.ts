/**
 * Type Configuration
 *
 * Module-augmentation interface that controls compile-time constraint branding.
 * All categories are enabled by default. Users disable per-category by declaring
 * a `.d.ts` file in their project:
 *
 * @example
 * // json-tology.d.ts
 * declare module 'json-tology/types' {
 *   interface JsonTologyTypeConfigInterface {
 *     formatBrands: false;   // disable format brands
 *     numericBrands: false;  // disable numeric brands
 *   }
 * }
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
}

/** Check whether a brand category is enabled, respecting the master switch. */
export type IsEnabledType<K extends keyof JsonTologyTypeConfigInterface>
  = JsonTologyTypeConfigInterface['brands'] extends false ? false
    : JsonTologyTypeConfigInterface[K] extends false ? false
      : true;
