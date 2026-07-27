import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/** Above this bound, `minItems`/`maxItems` tuple-literal inference widens to `TItem[]`. */
export namespace TupleCapEntity {
  export const Schema = { 'const': 16 } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    return candidate === 16;
  }
}
