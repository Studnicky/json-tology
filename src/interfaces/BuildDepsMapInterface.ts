/**
 * Named return type for {@link buildDepsMap}.
 *
 * A map from each subject IRI to the set of IRIs it depends on via `$ref`.
 *
 * @remarks
 * Used by the topological sort to determine safe emission order for schema
 * constants: a schema must appear after all schemas it references.
 *
 * A real `Map`/`Set` pairing (Kahn's-algorithm hot path), so it is authored as
 * an interface extending `Map` rather than a type alias — `Map` is a runtime
 * class-instance type, not schema-derived data.
 *
 * @example
 * ```ts
 * const deps = buildDepsMap(iris, schemaByIri, irisSet);
 * ```
 *
 * @category Codegen
 * @since 0.18.0
 * @see {@link OwlCodegen.toTypeScript}
 * @group OWL Codegen
 */
export interface BuildDepsMapInterface extends Map<string, Set<string>> {}
