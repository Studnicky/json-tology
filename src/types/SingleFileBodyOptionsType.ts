import type { JsonSchemaDocumentObjectType } from '../types/Schema.js';

/**
 * Options object for {@link buildSingleFileBody}.
 *
 * @remarks
 * Bundles the computed context for single-file mode TypeScript emission
 * so that `OwlCodegen.toTypeScript` stays within the 50-line limit.
 *
 * @example
 * ```ts
 * buildSingleFileBody({ sortedIris, nameMap, schemas, effectiveBaseIri, inferTypeImportPath, registryConstName });
 * ```
 *
 * @category Codegen
 * @since 0.18.0
 * @see {@link OwlCodegen.toTypeScript}
 * @group OWL Codegen
 */
export type SingleFileBodyOptionsType = {
  /** Effective base IRI for `JsonTology.create`. */
  'effectiveBaseIri': string;
  /** Import path for `InferType`. */
  'inferTypeImportPath': string;
  /** Map from IRI to PascalCase identifier. */
  'nameMap': Map<string, string>;
  /** Name of the exported registry constant. */
  'registryConstName': string;
  /** All consumer-facing schemas. */
  'schemas': JsonSchemaDocumentObjectType[];
  /** Sorted IRIs in emission order. */
  'sortedIris': string[];
};
