import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/**
 * Result of {@link SchemaIriInterface.splitSubject} — a subject IRI split
 * into base and fragment parts at the `#` boundary.
 */
export namespace SplitSubjectResultEntity {
  export const Schema = {
    'properties': {
      'base': { 'type': 'string' },
      'fragment': {
        'type': [
          'string',
          'null'
        ]
      }
    },
    'required': [
      'base',
      'fragment'
    ],
    'type': 'object'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    if (typeof candidate !== 'object' || candidate === null) {
      return false;
    }

    const value = candidate as Record<string, unknown>;

    return typeof value.base === 'string'
      && (typeof value.fragment === 'string' || value.fragment === null);
  }
}
