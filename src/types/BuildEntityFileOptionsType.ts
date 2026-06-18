import type { JsonSchemaDocumentObjectType } from '../types/Schema.js';

/**
 * Options object for the {@link buildEntityFileSource} helper.
 *
 * @remarks
 * Bundles the parameters needed to build a single entity file source string
 * into a single options shape, satisfying the parameter-count limit.
 *
 * @example
 * ```ts
 * buildEntityFileSource({ iri, name, schema, ts, sourceLabel });
 * ```
 *
 * @category Codegen
 * @since 0.18.0
 * @see {@link OwlCodegen.toRegistryFiles}
 * @group OWL Codegen
 */
export type BuildEntityFileOptionsType = {
  /** Full IRI of the OWL class. */
  readonly 'iri': string;
  /** PascalCase identifier for this class. */
  readonly 'name': string;
  /** Name of the schema-set reference-map type exported by `index.ts`. */
  readonly 'refsName': string;
  /** The JSON Schema object for this class. */
  readonly 'schema': JsonSchemaDocumentObjectType;
  /** Human-readable source label (file path or IRI), or empty string. */
  readonly 'sourceLabel': string;
  /** ISO-8601 timestamp string. */
  readonly 'ts': string;
};
