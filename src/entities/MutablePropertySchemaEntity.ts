import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/**
 * Mutable property-level JSON Schema shape accumulated during property
 * restriction processing in the PropertyRestrictions dispatcher.
 */
export namespace MutablePropertySchemaEntity {
  export const Schema = {
    'properties': {
      // `const` mirrors an author-supplied JSON Schema `const` value, which is
      // inherently arbitrary — the empty schema `{}` is JSON Schema's own
      // notation for "any value" and matches the convention already used for
      // RawRestrictionDescriptorEntity's `value` field.
      'const': {},
      'items': {
        'properties': { '$ref': { 'type': 'string' } },
        'required': ['$ref'],
        'type': 'object'
      },
      'maxItems': { 'type': 'number' },
      'minItems': { 'type': 'number' }
    },
    'type': 'object'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    if (typeof candidate !== 'object' || candidate === null) {
      return false;
    }

    const value = candidate as Record<string, unknown>;

    return (value.maxItems === undefined || typeof value.maxItems === 'number')
      && (value.minItems === undefined || typeof value.minItems === 'number')
      && (value.items === undefined || (typeof value.items === 'object' && value.items !== null));
  }
}
