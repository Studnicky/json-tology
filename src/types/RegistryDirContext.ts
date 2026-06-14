import type { JsonSchemaDocumentObjectType } from '../types/Schema.js';

/**
 * Options object for {@link buildEntityFiles} and {@link buildIndexSource}.
 *
 * @remarks
 * Bundles the common registry-directory context into a single shape so
 * helpers with many parameters can accept a single options object.
 *
 * @example
 * ```ts
 * buildEntityFiles({ sortedIris, nameMap, schemas, ts, sourceLabel });
 * ```
 *
 * @category Codegen
 * @since 0.18.0
 * @see {@link generateRegistryFiles}
 * @group OWL Codegen
 */
export type RegistryDirContextType = {
  /** Map from IRI to PascalCase identifier. */
  readonly 'nameMap': Map<string, string>;
  /** Name of the schema-set reference-map type exported by `index.ts`. */
  readonly 'refsName': string;
  /** All consumer-facing schemas. */
  readonly 'schemas': JsonSchemaDocumentObjectType[];
  /** Sorted IRIs in emission order. */
  readonly 'sortedIris': string[];
  /** Human-readable source label, or empty string. */
  readonly 'sourceLabel': string;
  /** ISO-8601 timestamp string. */
  readonly 'ts': string;
};
