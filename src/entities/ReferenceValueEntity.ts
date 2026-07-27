import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';
import { StringValueEntity } from './StringValueEntity.js';

/** A `$ref` pointer string being resolved during branch scanning. */
export namespace ReferenceValueEntity {
  export const Schema = { ...StringValueEntity.Schema } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    const isString = StringValueEntity.validate(candidate);

    return isString;
  }
}
