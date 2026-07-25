/**
 * Default `GraphEngine` option values — expressed as a json-tology schema.
 */

import type { InferType } from './Schema.js';

/**
 * Every field of `GraphEngineOptionsType` that carries a static default,
 * spelled out explicitly and required.
 *
 * @remarks
 * Excludes `formatRegistry`, `keywords`, `logger`, `lookupGraph`, and `lookupSchema`,
 * which have no static default and are supplied per call.
 */
export const DEFAULT_GRAPH_ENGINE_OPTIONS_SCHEMA = {
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
} as const;

export type DefaultGraphEngineOptionsType = InferType<typeof DEFAULT_GRAPH_ENGINE_OPTIONS_SCHEMA>;
