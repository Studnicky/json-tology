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

void 0 as unknown as [typeof _ok, typeof _bad];
