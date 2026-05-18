import type { InferType } from '../../../src/types/index.js';

const thenBranch = {
  'properties': { 'radius': { 'type': 'number' } },
  'required': ['radius']
} as const;

// Reflect.set used to attach 'then' keyword (unicorn/no-thenable disallows it in literals)
const ShapeSchemaBase = {
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
  'type': 'object'
} as const;

Reflect.set(ShapeSchemaBase, 'then', thenBranch);

type Shape = InferType<typeof ShapeSchemaBase & { 'then': typeof thenBranch }>;
// Union of:
//   { kind: 'circle'; radius: number; ... }     - then branch, kind narrowed to 'circle'
// | { kind: string; width: number; ... }         - else branch
void 0 as unknown as Shape;
