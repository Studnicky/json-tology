import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/** A (predicate IRI, subject IRI) pair stored in the byObject index. */
export namespace AboxPredicateSubjectEntity {
  export const Schema = {
    'properties': {
      'predicate': { 'type': 'string' },
      'subject': { 'type': 'string' }
    },
    'required': [
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

    return typeof value.predicate === 'string'
      && typeof value.subject === 'string';
  }
}
