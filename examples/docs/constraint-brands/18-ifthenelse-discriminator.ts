import type { InferType } from '../../../src/types/index.js';

const _ShapeSchema = {
  'else': {
    'properties': { 'width': { 'type': 'number' } },
    'required': ['width']
  },
  'if': {
    'properties': { 'kind': { 'const': 'circle' } },
    'required': ['kind']
  },
  'properties': { 'kind': { 'type': 'string' } },
  'required': ['kind'],
  'then': {
    'properties': { 'radius': { 'type': 'number' } },
    'required': ['radius']
  },
  'type': 'object'
} as const;

type Shape = InferType<typeof _ShapeSchema>;
// Union of:
//   { kind: 'circle'; radius: number; ... }     - then branch, kind narrowed to 'circle'
// | { kind: string; width: number; ... }         - else branch

// Representative runtime values for each discriminated branch.
const circle: Shape = {
  'kind': 'circle',
  'radius': 5
};
const rectangle: Shape = {
  'kind': 'rect',
  'width': 10
};

console.log('if/then branch (circle, radius narrowed):', circle);
console.log('else branch (rect, width required):', rectangle);
