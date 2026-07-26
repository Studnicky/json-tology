/**
 * Phantom brand attached to a class declared `disjointWith` another.
 *
 * @remarks
 * Values typed as `DisjointWithBrandInterface<OtherId>` are structurally
 * incompatible with values typed as `DisjointWithBrandInterface<OtherId>`
 * carrying the same brand, so assigning a value of the "other" class to the
 * "this" class position is a compile error when the asymmetric brand is
 * checked.
 *
 * @example
 * ```ts
 * type Dog = DisjointWithBrandInterface<'https://example.com/Cat'> & { name: string };
 * ```
 *
 * @category Restriction Inference
 * @since 0.18.0
 * @see {@link ComplementOfBrandInterface}
 * @group Restriction Inference
 *
 * @typeParam TOtherId - The `$id` IRI of the class declared disjoint.
 */
export interface DisjointWithBrandInterface<TOtherId extends string> {
  '~jt:disjointWith': Record<TOtherId, 'disjoint'>;
}
