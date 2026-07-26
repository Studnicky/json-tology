import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/** IRI of the ABox instance a scalar value is being projected onto. */
export namespace InstanceIriValueEntity {
  export const Schema = { 'type': 'string' } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    return typeof candidate === 'string';
  }
}
