import type { InferType } from '../types/Schema.js';

/**
 * Primitive type names supported by JSON Schema's `type` keyword.
 *
 * @remarks
 * Matches the string values permitted by the `type` keyword in JSON Schema
 * Draft-2020-12 §6.1.1. The `integer` member is distinct from `number` — it
 * constrains the value to have no fractional part. Used as the element type of
 * the `type` field on {@link JsonSchemaDocumentObjectType}.
 *
 * @example
 * ```ts
 * const t: JsonSchemaTypeNameEntity.Type = 'string';
 * ```
 *
 * @category Schema Utilities
 * @since 0.10.0
 * @see {@link JsonSchemaDocumentObjectType}
 * @group Schema Utilities
 */
export namespace JsonSchemaTypeNameEntity {
  export const Schema = {
    'enum': [
      'array',
      'boolean',
      'integer',
      'null',
      'number',
      'object',
      'string'
    ],
    'type': 'string'
  } as const;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    return candidate === 'array'
      || candidate === 'boolean'
      || candidate === 'integer'
      || candidate === 'null'
      || candidate === 'number'
      || candidate === 'object'
      || candidate === 'string';
  }
}
