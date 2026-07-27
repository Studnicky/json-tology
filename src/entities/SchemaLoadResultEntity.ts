import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';
import { SchemaLoadErrorEntity } from './SchemaLoadErrorEntity.js';

/**
 * Describes the aggregate outcome of a bulk schema-load operation.
 *
 * @remarks
 * Summarises loading one or more schemas. Shape: `{ successful, skipped, failed, errors }`.
 * `successful` is the count of schemas that loaded without error. `skipped` is the count
 * of IRIs already registered. `failed` is the count of schemas that could not be loaded.
 * `errors` is an array of {@link SchemaLoadErrorEntity.Type} descriptors, one per failure.
 *
 * @example
 * ```ts
 * const result: SchemaLoadResultEntity.Type = {
 *   errors: [],
 *   failed: 0,
 *   skipped: 1,
 *   successful: 5,
 * };
 * ```
 *
 * @category Schema Utilities
 * @since 0.10.0
 * @see {@link SchemaLoadErrorEntity}
 * @group Schema Utilities
 */
export namespace SchemaLoadResultEntity {
  export const Schema = {
    '$id': 'https://json-tology.dev/SchemaLoadResult',
    'properties': {
      'errors': {
        'items': SchemaLoadErrorEntity.Schema,
        'type': 'array'
      },
      'failed': { 'type': 'number' },
      'skipped': { 'type': 'number' },
      'successful': { 'type': 'number' }
    },
    'required': [
      'errors',
      'failed',
      'skipped',
      'successful'
    ],
    'type': 'object'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    if (typeof candidate !== 'object' || candidate === null) {
      return false;
    }

    const value = candidate as Record<string, unknown>;

    return Array.isArray(value.errors)
      && typeof value.failed === 'number'
      && typeof value.skipped === 'number'
      && typeof value.successful === 'number';
  }
}
