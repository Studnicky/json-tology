/**
 * Phantom brand attached to a class declared as the OWL `complementOf` another.
 *
 * @remarks
 * Uses a distinct symbol from `DisjointWithBrandInterface` so a class can carry
 * both brands simultaneously — one for disjointness, one for complement —
 * without the brand keys colliding.
 *
 * @example
 * ```ts
 * type NonDog = ComplementOfBrandInterface<'https://example.com/Dog'> & { name: string };
 * ```
 *
 * @category Restriction Inference
 * @since 0.18.0
 * @see {@link DisjointWithBrandInterface}
 * @group Restriction Inference
 *
 * @typeParam TOtherId - The `$id` IRI of the class this class is the complement of.
 */
export interface ComplementOfBrandInterface<TOtherId extends string> {
  '~jt:complementOf': Record<TOtherId, 'complement'>;
}
