import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/** A single number field, shared by interfaces whose members are bare numbers. */
export namespace NumberValueEntity {
  export const Schema = { 'type': 'number' } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    return typeof candidate === 'number';
  }
}
