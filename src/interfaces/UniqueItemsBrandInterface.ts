import type { UNIQUE_ITEMS } from '../types/ConstraintBrands.js';

/**
 * Phantom brand for the `uniqueItems: true` keyword.
 *
 * Marks an array as having been validated for element distinctness.
 * Plain arrays are not assignable to this brand without passing through
 * the validation API.
 *
 * @remarks
 * Attach via `InferSchemaType` when `arrayBrands` is enabled.
 * See {@link UniqueArrayBrandInterface} for the parameterised variant.
 *
 * @example
 * ```ts
 * declare const t: UniqueItemsBrandInterface;
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link UniqueArrayBrandInterface}
 * @group Constraint Brands
 */
export interface UniqueItemsBrandInterface {
  readonly [UNIQUE_ITEMS]: true;
}
