/**
 * `not` exclusion — removes primitives or values from the inferred type.
 *
 * `not: { type }` excludes a primitive from a union.
 * `not: { const }` removes a specific value from an enum.
 * `not: { enum }` removes a set of values from an enum.
 */

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

// Runtime demonstration: values that satisfy each narrowed type
const nonString: NonString = 42;
const nonNullStatus: NonNullStatus = 'active';
const restricted: Restricted = 'a';

console.log('NonString (boolean | number):', nonString);
console.log('NonNullStatus (active | inactive):', nonNullStatus);
console.log('Restricted (a | d):', restricted);
