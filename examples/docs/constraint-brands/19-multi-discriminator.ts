/**
 * Multi-key discriminator narrowing — InferType handles `if` clauses
 * with multiple required `const`-pinned properties. The result is a
 * discriminated union narrowed on every if-pinned key. `then` here
 * is the JSON Schema keyword, not a Promise method.
 */

import type { InferType } from '../../../src/types/index.js';

/* eslint-disable unicorn/no-thenable -- 'then' is a JSON Schema keyword, not a Promise thenable. */
const _MultiDiscriminatorSchema = {
  'else': {
    'properties': { 'width': { 'type': 'number' } },
    'required': ['width']
  },
  'if': {
    'properties': {
      'color': { 'const': 'red' },
      'kind': { 'const': 'circle' }
    },
    'required': [
      'kind',
      'color'
    ]
  },
  'properties': {
    'color': { 'type': 'string' },
    'kind': { 'type': 'string' }
  },
  'required': [
    'kind',
    'color'
  ],
  'then': {
    'properties': { 'radius': { 'type': 'number' } },
    'required': ['radius']
  },
  'type': 'object'
} as const;
/* eslint-enable unicorn/no-thenable */

type MultiShape = InferType<typeof _MultiDiscriminatorSchema>;

// Representative values for each discriminated branch.
const redCircle: MultiShape = {
  'color': 'red',
  'kind': 'circle',
  'radius': 7
};
const other: MultiShape = {
  'color': 'blue',
  'kind': 'square',
  'width': 4
};

console.log('if/then branch (kind=circle, color=red, radius narrowed):', redCircle);
console.log('else branch (other kind/color, width required):', other);
