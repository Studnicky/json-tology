import type { JsonSchemaDocumentObjectType } from '../types/Schema.js';

/**
 * Options object for {@link buildSingleFileBody}.
 *
 * @remarks
 * Bundles the computed context for single-file mode TypeScript emission
 * so that `generateTypeScript` stays within the 50-line limit.
 *
 * @example
 * ```ts
 * buildSingleFileBody({ sortedIris, nameMap, schemas, effectiveBaseIRI, inferTypeImportPath, registryConstName });
 * ```
 *
 * @category Codegen
 * @since 0.18.0
 * @see {@link generateTypeScript}
 * @group OWL Codegen
 */
export type SingleFileBodyOptionsType = {
  /** Effective base IRI for `JsonTology.create`. */
  readonly 'effectiveBaseIRI': string;
  /** Import path for `InferType`. */
  readonly 'inferTypeImportPath': string;
  /** Map from IRI to PascalCase identifier. */
  readonly 'nameMap': Map<string, string>;
  /** Name of the exported registry constant. */
  readonly 'registryConstName': string;
  /** All consumer-facing schemas. */
  readonly 'schemas': JsonSchemaDocumentObjectType[];
  /** Sorted IRIs in emission order. */
  readonly 'sortedIris': string[];
};
