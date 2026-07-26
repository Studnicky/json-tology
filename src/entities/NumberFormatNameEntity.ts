import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/** Built-in number format names recognized by json-tology. */
export namespace NumberFormatNameEntity {
  export const Schema = {
    'enum': [
      'double',
      'float',
      'int32',
      'int64'
    ]
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    return typeof candidate === 'string' && (Schema.enum as readonly string[]).includes(candidate);
  }
}
