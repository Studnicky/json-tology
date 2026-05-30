import type { InferType } from '../../../src/types/index.js';

const _ClosedSchema = {
  'additionalProperties': false,
  'properties': {
    'age': { 'type': 'integer' },
    'name': { 'type': 'string' }
  },
  'type': 'object'
} as const;

type Closed = InferType<typeof _ClosedSchema>;

// compiles
const _ok: Closed = {
  'age': 30,
  'name': 'Bastian Balthazar Bux'
};
// compile error - 'extra' is never
const _bad: Closed = {
  'extra': true,
  'name': 'Carl Conrad Coreander'
} as unknown as Closed;

console.log('Valid closed object:', _ok);
// _bad is held via `as unknown as Closed` — at runtime it is a plain object.
console.log('Invalid (excess key "extra") assigned via cast:', _bad);
