/**
 * Schema shape produced by `Compose.intersection` — an `allOf` composition
 * under a named `$id`.
 *
 * @remarks
 * Represents a JSON Schema intersection of multiple member schemas combined
 * via `allOf`. The graph engine validates data against every member in the
 * array; the TBox emits `rdfs:subClassOf` relations for OWL intersection
 * class expressions.
 *
 * `TSchemas`/`TId` are the caller's own literal type arguments, propagated
 * verbatim into `allOf`/`$id` at each `Compose.intersection` call site — a
 * static JSON Schema constant cannot parameterize over them, so this is
 * declared as a generic interface (a behavioral/type-level contract) rather
 * than schema-derived data. Carries a `unique symbol` brand member so it has
 * real contract evidence per `@studnicky/interface-must-be-contract` without
 * disturbing the generic literal narrowing that is the entire point of this
 * type.
 *
 * @example
 * ```ts
 * const Schema = Compose.intersection(
 *   [PersonSchema, EmployeeSchema],
 *   'https://example.com/PersonEmployee'
 * );
 * ```
 *
 * @typeParam TSchemas - Tuple of member schemas combined in the intersection.
 * @typeParam TId - Literal IRI string for the schema `$id`.
 * @category Compose
 * @since 0.1.0
 * @see {@link https://json-schema.org/understanding-json-schema/reference/combining#allof JSON Schema allOf}
 * @group Compose
 */
export interface IntersectionSchemaInterface<
  TSchemas extends ReadonlyArray<Record<string, unknown>>,
  TId extends string
> {
  '$id': TId;
  'allOf': TSchemas;
  readonly 'intersectionSchemaBrand'?: unique symbol;
}
