import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/** Bundled execution flags passed through validation helper methods. */
export namespace ValidationRunOptionsEntity {
  export const Schema = {
    'properties': {
      'applyDefaults': { 'type': 'boolean' },
      'coerce': { 'type': 'boolean' },
      'collectErrors': { 'type': 'boolean' },
      'stripUnknown': { 'type': 'boolean' }
    },
    'required': [
      'applyDefaults',
      'coerce',
      'collectErrors',
      'stripUnknown'
    ],
    'type': 'object'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    if (typeof candidate !== 'object' || candidate === null) {
      return false;
    }

    const value = candidate as Record<string, unknown>;

    return typeof value.applyDefaults === 'boolean'
      && typeof value.coerce === 'boolean'
      && typeof value.collectErrors === 'boolean'
      && typeof value.stripUnknown === 'boolean';
  }
}
