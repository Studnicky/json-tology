import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';
import { SchemaLoadReasonEntity } from './SchemaLoadReasonEntity.js';

/**
 * Describes a single schema-load failure.
 *
 * @remarks
 * Produced by the schema loader when a load attempt fails. Shape: `{ file, message, reason, status? }`.
 * `file` is the source path or IRI that was being loaded. `reason` is a string enum
 * classifying the failure (e.g. `'missing-id'`, `'fetch-failed'`, `'invalid-schema'`).
 * `status` is an optional numeric HTTP status code present only on remote fetch failures.
 *
 * @example
 * ```ts
 * const err: SchemaLoadErrorEntity.Type = {
 *   file: 'https://example.com/User',
 *   message: 'HTTP 503 loading schema',
 *   reason: 'fetch-failed',
 *   status: 503,
 * };
 * ```
 *
 * @category Schema Utilities
 * @since 0.10.0
 * @see {@link SchemaLoadResultEntity}
 * @group Schema Utilities
 */
export namespace SchemaLoadErrorEntity {
  export const Schema = {
    '$id': 'https://json-tology.dev/SchemaLoadError',
    'properties': {
      'file': { 'type': 'string' },
      'message': { 'type': 'string' },
      'reason': SchemaLoadReasonEntity.Schema,
      'status': { 'type': 'number' }
    },
    'required': [
      'file',
      'message',
      'reason'
    ],
    'type': 'object'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    if (typeof candidate !== 'object' || candidate === null) {
      return false;
    }

    const value = candidate as Record<string, unknown>;

    return typeof value.file === 'string'
      && typeof value.message === 'string'
      && SchemaLoadReasonEntity.Schema.enum.includes(value.reason as SchemaLoadReasonEntity.Type)
      && (value.status === undefined || typeof value.status === 'number');
  }
}
