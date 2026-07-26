/**
 * Mints subject IRIs for RDF instances projected from JSON data values.
 *
 * @remarks
 * Implementations derive a stable IRI from the combination of class ID,
 * runtime value, JSON path, and recursion depth. The minted IRI is used as
 * the RDF subject for the projected ABox individual.
 *
 * @example
 * ```ts
 * const iri = minter.mint('https://example.com/User', data, '/users/0', 0);
 * ```
 *
 * @category Projection
 * @since 0.10.0
 * @see {@link ProjectInstanceArgumentListInterface}
 * @group ABox
 */
export interface IriMinterInterface {
  mint(classId: string, value: unknown, path: string, depth: number): string;
}
