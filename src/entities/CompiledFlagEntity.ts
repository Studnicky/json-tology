import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/** Whether a validator is a real compiled validator, as opposed to an engine fallback. */
export namespace CompiledFlagEntity {
  export const Schema = { 'type': 'boolean' } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    return typeof candidate === 'boolean';
  }
}
