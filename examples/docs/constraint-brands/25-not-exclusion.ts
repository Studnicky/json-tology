import type { InferType } from '../../../src/types/index.js';

// not: { type }  - removes primitives from unions
const _NonStringSchema = {
  'not': { 'type': 'string' },
  'type': [
    'string',
    'number',
    'boolean'
  ]
} as const;

// boolean | number
type NonString = InferType<typeof _NonStringSchema>;

// not: { const }  - removes specific values
const _NonNullStatusSchema = {
  'enum': [
    'active',
    'inactive',
    null
  ],
  'not': { 'const': null }
} as const;

// 'active' | 'inactive'
type NonNullStatus = InferType<typeof _NonNullStatusSchema>;

// not: { enum }  - removes a set of values
const _RestrictedSchema = {
  'enum': [
    'a',
    'b',
    'c',
    'd'
  ],
  'not': {
    'enum': [
      'b',
      'c'
    ]
  }
} as const;

// 'a' | 'd'
type Restricted = InferType<typeof _RestrictedSchema>;
void 0 as unknown as [NonString, NonNullStatus, Restricted];
