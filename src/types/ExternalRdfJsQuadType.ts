/**
 * ExternalRdfJsQuadType — minimal RDF/JS quad shape as returned by jsonld.js v8
 * in object-graph output mode (`{ '@default': [...] }`).
 *
 * Only the fields required by OwlImporter's fromJsonLdRdfOutput conversion
 * helper are declared here.
 */

import type { InferType } from './Schema.js';

export const ExternalRdfJsQuadSchema = {
  'properties': {
    'object': {
      'properties': {
        'datatype': {
          'properties': { 'value': { 'type': 'string' } },
          'required': ['value'],
          'type': 'object'
        },
        'language': { 'type': 'string' },
        'termType': { 'type': 'string' },
        'value': { 'type': 'string' }
      },
      'required': [
        'termType',
        'value'
      ],
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
} as const;

export type ExternalRdfJsQuadType = InferType<typeof ExternalRdfJsQuadSchema>;
