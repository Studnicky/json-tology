import type { InferType } from './Schema.js';

export const VALIDATION_RUN_OPTIONS_SCHEMA = {
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
} as const;

/** Bundled execution flags passed through validation helper methods. */
export type ValidationRunOptionsType = InferType<typeof VALIDATION_RUN_OPTIONS_SCHEMA>;
