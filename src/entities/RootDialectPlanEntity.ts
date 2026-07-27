import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

export namespace RootDialectPlanEntity {
  export const Schema = {
    'additionalProperties': false,
    'properties': {
      'contentAssertions': { 'type': 'boolean' },
      'formatAssertions': { 'type': 'boolean' }
    },
    'required': [
      'contentAssertions',
      'formatAssertions'
    ],
    'type': 'object'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    if (typeof candidate !== 'object' || candidate === null) {
      return false;
    }

    const value = candidate as Record<string, unknown>;

    return typeof value.contentAssertions === 'boolean' && typeof value.formatAssertions === 'boolean';
  }
}
