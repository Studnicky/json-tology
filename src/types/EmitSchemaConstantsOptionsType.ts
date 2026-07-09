import type { JsonSchemaDocumentObjectType } from '../types/Schema.js';

/**
 * Options object for the {@link emitSchemaConstants} helper.
 *
 * @remarks
 * Bundles the parameters needed to emit per-class schema constants into a
 * single options shape, satisfying the parameter-count limit.
 *
 * @example
 * ```ts
 * emitSchemaConstants(lines, { sortedIris, nameMap, schemas });
 * ```
 *
 * @category Codegen
 * @since 0.18.0
 * @see {@link OwlCodegen.toTypeScript}
 * @group OWL Codegen
 */
export type EmitSchemaConstantsOptionsType = {
  /** Map from IRI to PascalCase identifier. */
  'nameMap': Map<string, string>;
  /** All consumer-facing schemas. */
  'schemas': JsonSchemaDocumentObjectType[];
  /** IRIs in emission order. */
  'sortedIris': string[];
};
