import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';
import { RdfTermKindEntity } from './RdfTermKindEntity.js';

/** A (predicate IRI, object IRI-or-literal-value) pair stored in the bySubject index. */
export namespace AboxPredicateObjectEntity {
  export const Schema = {
    'properties': {
      'object': { 'type': 'string' },
      'objectTermType': {
        'enum': [
          'BlankNode',
          'Literal',
          'NamedNode'
        ]
      },
      'predicate': { 'type': 'string' }
    },
    'required': [
      'object',
      'objectTermType',
      'predicate'
    ],
    'type': 'object'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    if (typeof candidate !== 'object' || candidate === null) {
      return false;
    }

    const value = candidate as Record<string, unknown>;

    return typeof value.object === 'string'
      && typeof value.predicate === 'string'
      && RdfTermKindEntity.validate(value.objectTermType);
  }
}
