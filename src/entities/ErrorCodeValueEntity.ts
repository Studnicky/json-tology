import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/** Machine-readable error code carried by a json-tology error instance. */
export namespace ErrorCodeValueEntity {
  export const Schema = { 'type': 'string' } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    return typeof candidate === 'string';
  }
}
