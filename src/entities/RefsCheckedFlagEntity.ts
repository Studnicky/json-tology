import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/** Whether a registered schema's `$ref` targets have already been resolved and checked. */
export namespace RefsCheckedFlagEntity {
  export const Schema = { 'type': 'boolean' } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    return typeof candidate === 'boolean';
  }
}
