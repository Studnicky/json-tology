import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';
import { ValidationErrorEntity } from './ValidationErrorEntity.js';

/**
 * The result value returned by {@link CompiledValidatorInterface.validate}.
 *
 * @remarks
 * Carries the canonical validation outcome: a validity flag, the (possibly
 * coerced or defaulted) value after processing, and any accumulated errors.
 * When `valid` is false, `errors` contains at least one entry.
 *
 * @example
 * ```ts
 * const result = validator.validate(input);
 * if (!result.valid) console.error(result.errors);
 * ```
 *
 * @category Compiler
 * @since 0.1.0
 * @see {@link CompiledValidatorInterface}
 * @group Validation
 */
export namespace CompiledValidationResultEntity {
  export const Schema = {
    'properties': {
      'errors': {
        'items': ValidationErrorEntity.Schema,
        'type': 'array'
      },
      'valid': { 'type': 'boolean' },
      'value': {}
    },
    'required': [
      'errors',
      'valid',
      'value'
    ],
    'type': 'object'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    if (typeof candidate !== 'object' || candidate === null) {
      return false;
    }

    const value = candidate as Record<string, unknown>;

    return Array.isArray(value.errors)
      && typeof value.valid === 'boolean'
      && 'value' in value;
  }
}
