import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/**
 * Schema-derived subject-IRI base for SHACL emit helper argument lists.
 *
 * @remarks
 * The projection context and relation index entry fields are not
 * JSON-representable (Map/interface-typed), so they are declared directly on
 * each consumer interface rather than composed here.
 */
export namespace ShaclEmitBaseArgumentsEntity {
  export const Schema = {
    'properties': { 'subject': { 'type': 'string' } },
    'required': ['subject'],
    'type': 'object'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    if (typeof candidate !== 'object' || candidate === null) {
      return false;
    }

    return typeof (candidate as Record<string, unknown>).subject === 'string';
  }
}
