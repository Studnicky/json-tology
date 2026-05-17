import type { InferType } from '../../../src/types/index.js';

const ClosedSchema = {
  'additionalProperties': false,
  'properties': {
    'age': { 'type': 'integer' },
    'name': { 'type': 'string' }
  },
  'type': 'object'
} as const;

type Closed = InferType<typeof ClosedSchema>;

const ok: Closed = {
  'age': 30,
  'name': 'Bastian Balthazar Bux'
}; // compiles
const bad: Closed = {
  'extra': true,
  'name': 'Bob'
}; // compile error  - 'extra' is never

void 0 as unknown as [typeof ok, typeof bad];
