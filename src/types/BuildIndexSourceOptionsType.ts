/**
 * Options object for {@link buildIndexSource}.
 *
 * @remarks
 * Bundles all parameters needed to generate the index.ts content for
 * registry-directory mode into a single options shape.
 *
 * @example
 * ```ts
 * buildIndexSource({ ctx, collisions, header, schemasConst, registryConstName, effectiveBaseIri, result });
 * ```
 *
 * @category Codegen
 * @since 0.18.0
 * @see {@link OwlCodegen.toRegistryFiles}
 * @group OWL Codegen
 */
export type BuildIndexSourceOptionsType = {
  /** Set of IRI base names that collided during name generation. */
  readonly 'collisions': Set<string>;
  /** Effective base IRI for `JsonTology.create`. */
  readonly 'effectiveBaseIri': string;
  /** Extra comment lines for the banner. */
  readonly 'header': readonly string[];
  /** Name of the exported registry constant. */
  readonly 'registryConstName': string;
  /** Name of the schemas array constant. */
  readonly 'schemasConst': string;
};
