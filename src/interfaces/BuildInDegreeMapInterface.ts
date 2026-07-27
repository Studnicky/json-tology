/**
 * Named return type for {@link buildInDegreeMap}.
 *
 * A map from each IRI to the count of schemas it directly depends on,
 * used as the forward in-degree during Kahn's topological sort.
 *
 * @remarks
 * When the in-degree reaches zero, the IRI has no unprocessed dependencies
 * and can safely be added to the sorted output.
 *
 * A real `Map` (Kahn's-algorithm hot path), so it is authored as an interface
 * extending `Map` rather than a type alias — `Map` is a runtime class-instance
 * type, not schema-derived data.
 *
 * @example
 * ```ts
 * const inDegree = buildInDegreeMap(iris, deps);
 * ```
 *
 * @category Codegen
 * @since 0.18.0
 * @see {@link OwlCodegen.toTypeScript}
 * @group OWL Codegen
 */
export interface BuildInDegreeMapInterface extends Map<string, number> {}
