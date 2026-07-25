import type { InferType } from './Schema.js';

const _JtConfigSchema = {
  'properties': {
    'extra': {
      'enum': [
        'allow',
        'forbid',
        'ignore'
      ]
    },
    'frozen': { 'type': 'boolean' },
    'strict': { 'type': 'boolean' }
  },
  'type': 'object'
} as const;

export type JtConfigType = InferType<typeof _JtConfigSchema>;
export type JtExtraType = NonNullable<JtConfigType['extra']>;
