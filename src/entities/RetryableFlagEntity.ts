import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/**
 * Set `true` only for transient failures whose cause is external and may clear
 * on retry (e.g. HTTP 5xx). Omit (defaults to `false`) for deterministic
 * failures that recur on identical input.
 */
export namespace RetryableFlagEntity {
  export const Schema = { 'type': 'boolean' } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    return typeof candidate === 'boolean';
  }
}
