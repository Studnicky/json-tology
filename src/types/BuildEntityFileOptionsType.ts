import type { InferType } from './Schema.js';
import type { JsonSchemaDocumentObjectType } from '../types/Schema.js';

export const BuildEntityFileOptionsTypeSchema = {
  'properties': {
    'iri': { 'type': 'string' },
    'name': { 'type': 'string' },
    'refsName': { 'type': 'string' },
    'sourceLabel': { 'type': 'string' },
    'ts': { 'type': 'string' }
  },
  'required': [
    'iri',
    'name',
    'refsName',
    'sourceLabel',
    'ts'
  ],
  'type': 'object'
} as const;

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
export type BuildEntityFileOptionsType = InferType<typeof BuildEntityFileOptionsTypeSchema>
  & { 'schema': JsonSchemaDocumentObjectType };
