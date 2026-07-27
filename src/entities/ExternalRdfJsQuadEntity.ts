import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';
import { RdfJsTermEntity } from './RdfJsTermEntity.js';

/**
 * ExternalRdfJsQuadEntity — minimal RDF/JS quad shape as returned by jsonld.js v8
 * in object-graph output mode (`{ '@default': [...] }`).
 *
 * Only the fields required by OwlImporter's fromJsonLdRdfOutput conversion
 * helper are declared here.
 */
export namespace ExternalRdfJsQuadEntity {
  export const Schema = {
    'properties': {
      'object': {
        'properties': {
          'datatype': {
            'properties': { 'value': { 'type': 'string' } },
            'required': ['value'],
            'type': 'object'
          },
          'language': { 'type': 'string' },
          ...RdfJsTermEntity.Schema.properties
        },
        'required': RdfJsTermEntity.Schema.required,
        'type': 'object'
      },
      'predicate': {
        'properties': { 'value': { 'type': 'string' } },
        'required': ['value'],
        'type': 'object'
      },
      'subject': {
        'properties': { 'value': { 'type': 'string' } },
        'required': ['value'],
        'type': 'object'
      }
    },
    'required': [
      'object',
      'predicate',
      'subject'
    ],
    'type': 'object'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    if (typeof candidate !== 'object' || candidate === null) {
      return false;
    }

    const value = candidate as Record<string, unknown>;

    return typeof value.object === 'object' && value.object !== null
      && typeof value.predicate === 'object' && value.predicate !== null
      && typeof value.subject === 'object' && value.subject !== null;
  }
}
