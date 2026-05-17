import type { InferType } from '../../../src/types/index.js';

// not: { type }  - removes primitives from unions
const NonStringSchema = {
  'not': { 'type': 'string' },
  'type': [
    'string',
    'number',
    'boolean'
  ]
} as const;

type NonString = InferType<typeof NonStringSchema>;
// boolean | number

// not: { const }  - removes specific values
const NonNullStatusSchema = {
  'enum': [
    'active',
    'inactive',
    null
  ],
  'not': { 'const': null }
} as const;

type NonNullStatus = InferType<typeof NonNullStatusSchema>;
// 'active' | 'inactive'

// not: { enum }  - removes a set of values
const RestrictedSchema = {
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

type Restricted = InferType<typeof RestrictedSchema>;
// 'a' | 'd'
void 0 as unknown as [NonString, NonNullStatus, Restricted];
