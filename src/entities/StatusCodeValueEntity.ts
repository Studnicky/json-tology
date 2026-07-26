import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/** HTTP status code returned by a failed schema fetch, when the failure came from a network response. */
export namespace StatusCodeValueEntity {
  export const Schema = { 'type': 'number' } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    return typeof candidate === 'number';
  }
}
