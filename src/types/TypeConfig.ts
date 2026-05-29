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

/**
 * Consumer-augmentable brand configuration.
 *
 * Carries ONLY a string→boolean index signature — no flag is declared with a
 * literal value. Defaults live in {@link IsEnabledType}, not here. This is
 * deliberate: a flag declared with a literal (e.g. `brands: true`) cannot be
 * augmented to `brands: false`, because conflicting property declarations are a
 * declaration-merge error that TypeScript silently drops — the augmentation
 * would never reach `IsEnabledType`. With only an index signature, each
 * augmented flag is a fresh specific property (assignable to the index type),
 * which merges cleanly and narrows the lookup so the consumer's value wins.
 *
 * Default state (no augmentation): every brand category is ENABLED, including
 * both tight-narrowing flags. The strict, most-precise types are the default;
 * consumers relax by augmenting a specific flag to `false`. There is no
 * opt-in flag — every recognised flag is on until explicitly disabled.
 *
 * Recognised flags (set any to `false` via augmentation to relax it):
 * - `brands` — master switch; `false` disables ALL brand categories.
 * - `arrayBrands` — uniqueItems / contains brands.
 * - `contentBrands` — contentMediaType / contentEncoding brands.
 * - `formatBrands` — format brands on strings and numbers.
 * - `nominalBrands` — `$id` / `$schema` dialect brands.
 * - `numericBrands` — minimum / maximum / multipleOf brands.
 * - `objectBrands` — minProperties / maxProperties and the excess-property
 *   index-signature brand on `additionalProperties: false` objects.
 * - `stringBrands` — minLength / maxLength / pattern brands.
 * - `tightStringLengths` — narrows tiny length-bounded strings to length-N
 *   template-literal types. Set `false` if tight length narrowing slows the
 *   type-checker on large schema fixtures.
 * - `tightIntegerRanges` — narrows small bounded integer schemas to literal
 *   union types (e.g. `0 | 1 | 2 | 3 | 4 | 5` for 0..5, within the 50-value
 *   cap). Set `false` to avoid TS2589 (type instantiation depth) when many
 *   bounded integer schemas are compiled together.
 *
 * @example Disable all brands for a project (in any `.d.ts` on the include path):
 * ```ts
 * export {};
 * declare module 'json-tology/types' {
 *   interface JsonTologyTypeConfigInterface { brands: false }
 * }
 * ```
 *
 * @example Relax tight string-length narrowing:
 * ```ts
 * export {};
 * declare module 'json-tology/types' {
 *   interface JsonTologyTypeConfigInterface { tightStringLengths: false }
 * }
 * ```
 *
 * @example Relax integer range narrowing:
 * ```ts
 * export {};
 * declare module 'json-tology/types' {
 *   interface JsonTologyTypeConfigInterface { tightIntegerRanges: false }
 * }
 * ```
 */
// An index signature (not a Record alias) is mandatory here: only an interface
// declaration-merges, and per-flag `false` augmentations would be TS2717
// conflicts against literal-typed members. The index signature lets a
// consumer's `brands: false` merge as a fresh assignable property.
// eslint-disable-next-line @typescript-eslint/consistent-indexed-object-style
export interface JsonTologyTypeConfigInterface {
  [flag: string]: boolean | undefined;
}

/**
 * Closed set of recognised brand-configuration flags.
 *
 * The augmentation interface above carries a string index signature so consumer
 * `declare module` augmentations merge cleanly — but an index signature widens
 * `keyof` to `string | number`, which would let typo'd flag names silently
 * resolve to a default instead of erroring. {@link IsEnabledType} is therefore
 * constrained by this explicit union, not by `keyof` of the interface, so an
 * unknown flag (e.g. `IsEnabledType<'tihgtIntegerRanges'>`) is a compile error.
 * Augmentability and closed-key typo-safety are kept independent.
 */
export type BrandFlagType
  = 'arrayBrands'
    | 'brands'
    | 'contentBrands'
    | 'formatBrands'
    | 'nominalBrands'
    | 'numericBrands'
    | 'objectBrands'
    | 'stringBrands'
    | 'tightIntegerRanges'
    | 'tightStringLengths';

/**
 * Check whether a brand category is enabled, respecting the master switch.
 *
 * Every flag is enabled by default: a flag resolves to `true` unless it is
 * augmented to `false` (or the master `brands: false` switch is set). Strict,
 * most-precise types are the default; consumers opt out per-flag.
 */
export type IsEnabledType<K extends BrandFlagType>
  = JsonTologyTypeConfigInterface['brands'] extends false ? false
    : JsonTologyTypeConfigInterface[K] extends false ? false
      : true;
