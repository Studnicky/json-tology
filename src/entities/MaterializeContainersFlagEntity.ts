import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/** Whether array/object containers are materialized into concrete JS values during validation. */
export namespace MaterializeContainersFlagEntity {
  export const Schema = { 'type': 'boolean' } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    return typeof candidate === 'boolean';
  }
}
