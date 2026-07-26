import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/** Accepted JSON-LD document shapes for `addFromJsonLd` / `addShaclFromJsonLd`. */
export namespace JsonLdDocumentInputEntity {
  export const Schema = {
    'oneOf': [
      {
        'items': { 'type': 'object' },
        'type': 'array'
      },
      { 'type': 'object' }
    ]
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    if (Array.isArray(candidate)) {
      return candidate.every((item) => {
        return typeof item === 'object' && item !== null;
      });
    }

    return typeof candidate === 'object' && candidate !== null;
  }
}
