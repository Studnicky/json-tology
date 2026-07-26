import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/** All built-in format names recognized by json-tology — the union of {@link StringFormatNameEntity} and {@link NumberFormatNameEntity}. */
export namespace BuiltinFormatNameEntity {
  export const Schema = {
    'enum': [
      'binary',
      'byte',
      'date',
      'date-time',
      'double',
      'duration',
      'email',
      'float',
      'hostname',
      'idn-email',
      'idn-hostname',
      'int32',
      'int64',
      'ipv4',
      'ipv6',
      'iri',
      'iri-reference',
      'json-pointer',
      'regex',
      'time',
      'uri',
      'uri-reference',
      'uri-template',
      'uuid'
    ]
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    return typeof candidate === 'string' && (Schema.enum as readonly string[]).includes(candidate);
  }
}
