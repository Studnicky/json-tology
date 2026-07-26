import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/**
 * An axiom/predicate IRI for a valid construct a dispatcher recognized but
 * does not project into the schema graph. Reported via `ctx.reportUnsupported`.
 */
export namespace UnsupportedAxiomEntity {
  export const Schema = {
    'properties': {
      'axiomIri': { 'type': 'string' },
      'subjectIri': {
        'type': [
          'string',
          'null'
        ]
      }
    },
    'required': [
      'axiomIri',
      'subjectIri'
    ],
    'type': 'object'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    if (typeof candidate !== 'object' || candidate === null) {
      return false;
    }

    const value = candidate as Record<string, unknown>;

    return typeof value.axiomIri === 'string'
      && (value.subjectIri === null || typeof value.subjectIri === 'string');
  }
}
