import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';
import { JsonSchemaTypeNameEntity } from './JsonSchemaTypeNameEntity.js';

/**
 * The `type` keyword's single-or-array-of-names form — a bare primitive type
 * name, or an array of them for the multi-type shorthand.
 *
 * @example
 * ```ts
 * const single: SchemaTypeNameOrArrayEntity.Type = 'string';
 * const multi: SchemaTypeNameOrArrayEntity.Type = ['string', 'null'];
 * ```
 */
export namespace SchemaTypeNameOrArrayEntity {
  export const Schema = {
    'anyOf': [
      JsonSchemaTypeNameEntity.Schema,
      {
        'items': JsonSchemaTypeNameEntity.Schema,
        'type': 'array'
      }
    ]
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  const TYPE_NAMES: ReadonlySet<string> = new Set([
    'array',
    'boolean',
    'integer',
    'null',
    'number',
    'object',
    'string'
  ]);

  export function validate(candidate: unknown): candidate is Type {
    if (typeof candidate === 'string' && TYPE_NAMES.has(candidate)) {
      return true;
    }

    return Array.isArray(candidate) && candidate.every((entry) => {
      return typeof entry === 'string' && TYPE_NAMES.has(entry);
    });
  }
}
