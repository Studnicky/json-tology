import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/** Recursion budget for pairwise transform-chain validation. */
export namespace ChainRecursionCapEntity {
  export const Schema = { 'const': 10 } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    return candidate === 10;
  }
}
