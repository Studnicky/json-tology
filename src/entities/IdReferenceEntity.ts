import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/** Minimal reference to an object by its `id`. */
export namespace IdReferenceEntity {
  export const Schema = {
    'properties': { 'id': { 'type': 'string' } },
    'required': ['id'],
    'type': 'object'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    if (typeof candidate !== 'object' || candidate === null) {
      return false;
    }

    const value = candidate as Record<string, unknown>;

    return typeof value.id === 'string';
  }
}
