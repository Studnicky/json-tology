import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';
import { StringFormatNameEntity } from './StringFormatNameEntity.js';
import { NumberFormatNameEntity } from './NumberFormatNameEntity.js';

/** All built-in format names recognized by json-tology — the union of {@link StringFormatNameEntity} and {@link NumberFormatNameEntity}. */
export namespace BuiltinFormatNameEntity {
  export const Schema = {
    'enum': [
      ...StringFormatNameEntity.Schema.enum,
      ...NumberFormatNameEntity.Schema.enum
    ]
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    return StringFormatNameEntity.validate(candidate) || NumberFormatNameEntity.validate(candidate);
  }
}
