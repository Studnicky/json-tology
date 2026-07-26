import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/**
 * A loosely-typed schema record known to carry a registered `$id`.
 *
 * Used at the registry/materialization boundary where the schema has not
 * been narrowed to the full {@link JsonSchemaDocumentType} shape.
 */
export namespace SchemaWithIdEntity {
  export const Schema = {
    'additionalProperties': true,
    'properties': { '$id': { 'type': 'string' } },
    'required': ['$id'],
    'type': 'object'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    if (typeof candidate !== 'object' || candidate === null) {
      return false;
    }

    return typeof (candidate as Record<string, unknown>).$id === 'string';
  }
}
