import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';
import { NumberValueEntity } from './NumberValueEntity.js';

/** Maximum recursion depth the registry allows while walking nested schema structure. */
export namespace SchemaDepthLimitEntity {
  export const Schema = { ...NumberValueEntity.Schema } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    const isNumber = NumberValueEntity.validate(candidate);

    return isNumber;
  }
}
