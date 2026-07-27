import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/**
 * Options controlling runtime behaviour of {@link CompiledValidatorInterface.validate}.
 *
 * @remarks
 * All flags default to false. Set `applyDefaults` to fill in schema-declared
 * default values, `castTypes` to coerce compatible primitives, `collectErrors`
 * to accumulate all errors rather than stopping at the first, and
 * `removeAdditionalProperties` / `enforceSchemaProperties` for structural
 * strictness beyond what the schema alone mandates.
 *
 * @example
 * ```ts
 * validator.validate(data, { applyDefaults: true, collectErrors: true });
 * ```
 *
 * @category Compiler
 * @since 0.1.0
 * @see {@link CompiledValidatorInterface}
 * @group Validation
 */
export namespace CompiledValidateOptionsEntity {
  export const Schema = {
    'properties': {
      'applyDefaults': { 'type': 'boolean' },
      'castTypes': { 'type': 'boolean' },
      'collectErrors': { 'type': 'boolean' },
      'enforceSchemaProperties': { 'type': 'boolean' },
      'ignoreAdditionalProperties': { 'type': 'boolean' },
      'removeAdditionalProperties': { 'type': 'boolean' },
      'synthesizeDefaults': { 'type': 'boolean' }
    },
    'type': 'object'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    if (typeof candidate !== 'object' || candidate === null) {
      return false;
    }

    const value = candidate as Record<string, unknown>;
    const flags = [
      value.applyDefaults,
      value.castTypes,
      value.collectErrors,
      value.enforceSchemaProperties,
      value.ignoreAdditionalProperties,
      value.removeAdditionalProperties,
      value.synthesizeDefaults
    ];

    return flags.every((flag) => {
      return flag === undefined || typeof flag === 'boolean';
    });
  }
}
