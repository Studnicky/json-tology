import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';
import { NumberValueEntity } from './NumberValueEntity.js';

/** Maximum recursion depth the graph engine walks while resolving nested schema structure. */
export namespace MaximumSchemaDepthValueEntity {
  export const Schema = { ...NumberValueEntity.Schema } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    const isNumber = NumberValueEntity.validate(candidate);

    return isNumber;
  }
}
