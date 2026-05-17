import type { InferType } from '../../../src/types/index.js';

const MultiDiscriminatorSchema = {
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

type MultiShape = InferType<typeof MultiDiscriminatorSchema>;
// { kind: 'circle'; color: 'red'; radius: number; ... }  - then branch
// | { kind: string; color: string; width: number; ... }  - else branch
void 0 as unknown as MultiShape;
