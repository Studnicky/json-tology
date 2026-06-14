/**
 * Consumer-augmentable brand-configuration interface.
 *
 * @remarks
 * An index signature (not a Record alias) is mandatory here: only an interface
 * declaration-merges, and per-flag `false` augmentations would be TS2717
 * conflicts against literal-typed members. The index signature lets a
 * consumer's `brands: false` merge as a fresh assignable property.
 *
 * @category Type Configuration
 * @since 0.1.0
 */
// An index signature (not a Record alias) is mandatory here: only an interface
// declaration-merges, and per-flag `false` augmentations would be TS2717
// conflicts against literal-typed members. The index signature lets a
// consumer's `brands: false` merge as a fresh assignable property.
// eslint-disable-next-line @typescript-eslint/consistent-indexed-object-style
export interface JsonTologyTypeConfigInterface {
  [flag: string]: boolean | undefined;
}
