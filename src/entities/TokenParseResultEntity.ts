import type { InferType } from '../types/Schema.js';

/**
 * Result of a single N-Quad token parse: the extracted token and the next position.
 *
 * `prefixItems` is a Draft 2020-12 keyword this project's own `InferType` infers
 * as a closed tuple; the `json-schema-to-ts` `JSONSchema` type does not model it
 * (it only knows the older `items` array-tuple form), so this schema is left
 * unchecked against that external type rather than widened to fit it.
 */
export namespace TokenParseResultEntity {
  export const Schema = {
    'prefixItems': [
      { 'type': 'string' },
      { 'type': 'number' }
    ],
    'type': 'array'
  } as const;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    return Array.isArray(candidate)
      && candidate.length === 2
      && typeof candidate[0] === 'string'
      && typeof candidate[1] === 'number';
  }
}
