import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/**
 * Default `GraphEngine` option values — expressed as a json-tology schema.
 */
export namespace DefaultGraphEngineOptionsEntity {
  /**
   * Every field of `GraphEngineOptionsInterface` that carries a static default,
   * spelled out explicitly and required.
   *
   * @remarks
   * Excludes `formatRegistry`, `keywords`, `logger`, `lookupGraph`, and `lookupSchema`,
   * which have no static default and are supplied per call.
   */
  export const Schema = {
    'properties': {
      'allowAdditionalProperties': { 'type': 'boolean' },
      'applyDefaults': { 'type': 'boolean' },
      'castTypes': { 'type': 'boolean' },
      'collectErrors': { 'type': 'boolean' },
      'enforceSchemaProperties': { 'type': 'boolean' },
      'materializeContainers': { 'type': 'boolean' },
      'maxSchemaDepth': { 'type': 'number' },
      'removeAdditionalProperties': { 'type': 'boolean' },
      'synthesizeDefaults': { 'type': 'boolean' }
    },
    'required': [
      'allowAdditionalProperties',
      'applyDefaults',
      'castTypes',
      'collectErrors',
      'enforceSchemaProperties',
      'materializeContainers',
      'maxSchemaDepth',
      'removeAdditionalProperties',
      'synthesizeDefaults'
    ],
    'type': 'object'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    if (typeof candidate !== 'object' || candidate === null) {
      return false;
    }

    const value = candidate as Record<string, unknown>;

    return typeof value.allowAdditionalProperties === 'boolean'
      && typeof value.applyDefaults === 'boolean'
      && typeof value.castTypes === 'boolean'
      && typeof value.collectErrors === 'boolean'
      && typeof value.enforceSchemaProperties === 'boolean'
      && typeof value.materializeContainers === 'boolean'
      && typeof value.maxSchemaDepth === 'number'
      && typeof value.removeAdditionalProperties === 'boolean'
      && typeof value.synthesizeDefaults === 'boolean';
  }
}
