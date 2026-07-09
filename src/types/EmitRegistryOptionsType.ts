/**
 * Options object for the {@link emitRegistryConstruction} helper.
 *
 * @remarks
 * Bundles the parameters needed to emit the registry array and
 * `JsonTology.create()` call into a single options shape.
 *
 * @example
 * ```ts
 * emitRegistryConstruction(lines, { schemasConst, registryConstName, schemaNames, effectiveBaseIri });
 * ```
 *
 * @category Codegen
 * @since 0.18.0
 * @see {@link OwlCodegen.toTypeScript}
 * @group OWL Codegen
 */
export type EmitRegistryOptionsType = {
  /** Effective base IRI for `JsonTology.create`. */
  'effectiveBaseIri': string;
  /** Name of the exported registry constant. */
  'registryConstName': string;
  /** Ordered list of PascalCase schema identifiers. */
  'schemaNames': string[];
  /** Name of the exported schemas array constant. */
  'schemasConst': string;
};
