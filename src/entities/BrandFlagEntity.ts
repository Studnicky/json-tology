import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/**
 * Closed set of recognised brand-configuration flags.
 *
 * The augmentation interface ({@link JsonTologyTypeConfigInterface}) carries a
 * string index signature so consumer `declare module` augmentations merge
 * cleanly — but an index signature widens `keyof` to `string | number`, which
 * would let typo'd flag names silently resolve to a default instead of
 * erroring. `IsEnabledType` (in `src/types/TypeConfig.js`) is therefore
 * constrained by this explicit enum, not by `keyof` of the interface, so an
 * unknown flag (e.g. `IsEnabledType<'tihgtIntegerRanges'>`) is a compile error.
 * Augmentability and closed-key typo-safety are kept independent.
 */
export namespace BrandFlagEntity {
  export const Schema = {
    'enum': [
      'arrayBrands',
      'brands',
      'contentBrands',
      'formatBrands',
      'nominalBrands',
      'numericBrands',
      'objectBrands',
      'stringBrands',
      'tightIntegerRanges',
      'tightStringLengths'
    ],
    'type': 'string'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    return typeof candidate === 'string' && (Schema.enum as readonly string[]).includes(candidate);
  }
}
