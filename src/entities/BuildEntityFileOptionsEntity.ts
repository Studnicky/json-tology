import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

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
export namespace BuildEntityFileOptionsEntity {
  export const Schema = {
    'additionalProperties': false,
    'properties': {
      'iri': { 'type': 'string' },
      'name': { 'type': 'string' },
      'refsName': { 'type': 'string' },
      'schema': { 'type': 'object' },
      'sourceLabel': { 'type': 'string' },
      'ts': { 'type': 'string' }
    },
    'required': [
      'iri',
      'name',
      'refsName',
      'schema',
      'sourceLabel',
      'ts'
    ],
    'type': 'object'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    if (typeof candidate !== 'object' || candidate === null) {
      return false;
    }

    const value = candidate as Record<string, unknown>;

    return typeof value.iri === 'string'
      && typeof value.name === 'string'
      && typeof value.refsName === 'string'
      && typeof value.schema === 'object' && value.schema !== null
      && typeof value.sourceLabel === 'string'
      && typeof value.ts === 'string';
  }
}
