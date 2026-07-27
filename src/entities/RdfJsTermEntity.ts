import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/**
 * The rdf/js term shape shared by `JsonLdDatasetQuadEntity`'s `DatasetTerm`
 * definition and `ExternalRdfJsQuadEntity`'s `object` field: a `termType`
 * discriminator and a string `value`.
 *
 * @category RDF
 * @since 0.1.0
 */
export namespace RdfJsTermEntity {
  export const Schema = {
    'properties': {
      'termType': { 'type': 'string' },
      'value': { 'type': 'string' }
    },
    'required': [
      'termType',
      'value'
    ],
    'type': 'object'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    return typeof candidate === 'object' && candidate !== null
      && typeof (candidate as Record<string, unknown>).termType === 'string'
      && typeof (candidate as Record<string, unknown>).value === 'string';
  }
}
