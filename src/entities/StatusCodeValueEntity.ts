import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';
import { NumberValueEntity } from './NumberValueEntity.js';

/** HTTP status code returned by a failed schema fetch, when the failure came from a network response. */
export namespace StatusCodeValueEntity {
  export const Schema = { ...NumberValueEntity.Schema } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    const isNumber = NumberValueEntity.validate(candidate);

    return isNumber;
  }
}
