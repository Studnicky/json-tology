import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/**
 * Serialization context for the literal-serializer helpers.
 *
 * @remarks
 * Bundles the pad and innerPad strings with the current indent depth so
 * the array and object serializer helpers do not need separate parameters.
 *
 * @example
 * ```ts
 * const ctx: SerializeContextEntity.Type = { pad, innerPad, indent };
 * ```
 *
 * @category Codegen
 * @since 0.18.0
 * @see {@link OwlCodegen.toTypeScript}
 * @group OWL Codegen
 */
export namespace SerializeContextEntity {
  export const Schema = {
    'properties': {
      'indent': { 'type': 'number' },
      'innerPad': { 'type': 'string' },
      'pad': { 'type': 'string' }
    },
    'required': [
      'indent',
      'innerPad',
      'pad'
    ],
    'type': 'object'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    if (typeof candidate !== 'object' || candidate === null) {
      return false;
    }

    const value = candidate as Record<string, unknown>;

    return typeof value.indent === 'number'
      && typeof value.innerPad === 'string'
      && typeof value.pad === 'string';
  }
}
