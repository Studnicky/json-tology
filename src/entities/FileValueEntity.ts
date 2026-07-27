import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';
import { StringValueEntity } from './StringValueEntity.js';

/** Path or URL of the schema file a load operation targeted. */
export namespace FileValueEntity {
  export const Schema = { ...StringValueEntity.Schema } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    const isString = StringValueEntity.validate(candidate);

    return isString;
  }
}
