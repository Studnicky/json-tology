import type { InferType } from './Schema.js';

export const ROOT_DIALECT_PLAN_SCHEMA = {
  'properties': {
    'contentAssertions': { 'type': 'boolean' },
    'formatAssertions': { 'type': 'boolean' }
  },
  'required': [
    'contentAssertions',
    'formatAssertions'
  ],
  'type': 'object'
} as const;

export type RootDialectPlanType = InferType<typeof ROOT_DIALECT_PLAN_SCHEMA>;
