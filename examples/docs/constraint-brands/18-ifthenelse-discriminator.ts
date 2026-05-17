import type { InferType } from '../../../src/types/index.js';

const ShapeSchema = {
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

type Shape = InferType<typeof ShapeSchema>;
// Union of:
//   { kind: 'circle'; radius: number; ... }     - then branch, kind narrowed to 'circle'
// | { kind: string; width: number; ... }         - else branch
void 0 as unknown as Shape;
