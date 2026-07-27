import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';
import { BooleanValueEntity } from './BooleanValueEntity.js';

/** Whether object properties absent from the schema's declared set are rejected outright. */
export namespace EnforceSchemaPropertiesFlagEntity {
  export const Schema = { ...BooleanValueEntity.Schema } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    const isBoolean = BooleanValueEntity.validate(candidate);

    return isBoolean;
  }
}
