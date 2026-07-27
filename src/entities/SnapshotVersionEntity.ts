import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/** Forward-compatibility discriminant for the {@link SnapshotInterface} on-disk format. Current shape is 1. */
export namespace SnapshotVersionEntity {
  export const Schema = { 'const': 1 } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    return candidate === 1;
  }
}
