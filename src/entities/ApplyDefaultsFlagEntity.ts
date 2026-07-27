import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';
import { BooleanValueEntity } from './BooleanValueEntity.js';

/** Whether schema-declared defaults are synthesized onto missing properties during validation. */
export namespace ApplyDefaultsFlagEntity {
  export const Schema = { ...BooleanValueEntity.Schema } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    const isBoolean = BooleanValueEntity.validate(candidate);

    return isBoolean;
  }
}
