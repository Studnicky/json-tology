import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/**
 * Named result type returned by every validate-with-errors call — validity flag and (potentially mutated) value.
 *
 * @remarks
 * When `applyDefaults`, `coerce`, or `stripUnknown` flags are set, the
 * validator may mutate or replace the value in place. Callers must use the
 * returned `value` rather than the original argument after the call.
 *
 * @example
 * ```ts
 * const result: ValidateWithErrorsResultEntity.Type = validator(input, '', errors, true, true, false, false);
 * if (result.valid) { use(result.value); }
 * ```
 *
 * @category Validation
 * @since 0.1.0
 */
export namespace ValidateWithErrorsResultEntity {
  export const Schema = {
    'properties': {
      'valid': { 'type': 'boolean' },
      'value': {}
    },
    'required': [
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

    return typeof value.valid === 'boolean' && 'value' in value;
  }
}
