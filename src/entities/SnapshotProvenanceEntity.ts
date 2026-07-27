import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/**
 * Per-schema provenance record produced by {@link JsonTology.prefetch}. Records
 * where the schema was fetched from and the wall-clock fetch time.
 */
export namespace SnapshotProvenanceEntity {
  export const Schema = {
    'properties': {
      'fetchedAt': { 'type': 'string' },
      'source': { 'type': 'string' }
    },
    'required': [
      'fetchedAt',
      'source'
    ],
    'type': 'object'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    if (typeof candidate !== 'object' || candidate === null) {
      return false;
    }

    const value = candidate as Record<string, unknown>;

    return typeof value.fetchedAt === 'string'
      && typeof value.source === 'string';
  }
}
