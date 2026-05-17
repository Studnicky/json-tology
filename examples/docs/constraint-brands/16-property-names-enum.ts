import type { InferType } from '../../../src/types/index.js';

const _ConfigSchema = {
  'additionalProperties': { 'type': 'string' },
  'propertyNames': {
    'enum': [
      'host',
      'port',
      'debug'
    ]
  },
  'type': 'object'
} as const;

type Config = InferType<typeof _ConfigSchema>;
// { readonly host?: string; readonly port?: string; readonly debug?: string }
void 0 as unknown as Config;
