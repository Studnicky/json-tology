import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/**
 * Union of all valid `reason` values for a schema-load failure.
 *
 * @remarks
 * Classifies why a schema failed to load (e.g. `'missing-id'`, `'fetch-failed'`,
 * `'invalid-schema'`). Embedded as the `reason` property schema within
 * {@link SchemaLoadErrorEntity.Schema} so the two stay in sync.
 */
export namespace SchemaLoadReasonEntity {
  export const Schema = {
    'enum': [
      'duplicate-anchor',
      'duplicate-id',
      'fetch-failed',
      'invalid-json',
      'invalid-schema',
      'missing-id',
      'not-json',
      'unknown'
    ],
    'type': 'string'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    return candidate === 'duplicate-anchor'
      || candidate === 'duplicate-id'
      || candidate === 'fetch-failed'
      || candidate === 'invalid-json'
      || candidate === 'invalid-schema'
      || candidate === 'missing-id'
      || candidate === 'not-json'
      || candidate === 'unknown';
  }
}
