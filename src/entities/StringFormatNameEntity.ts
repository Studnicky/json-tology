import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/** Built-in string format names recognized by json-tology. */
export namespace StringFormatNameEntity {
  export const Schema = {
    'enum': [
      'binary',
      'byte',
      'date',
      'date-time',
      'duration',
      'email',
      'hostname',
      'idn-email',
      'idn-hostname',
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
