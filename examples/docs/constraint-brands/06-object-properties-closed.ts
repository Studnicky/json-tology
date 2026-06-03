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

// compiles — only the declared properties are present.
const ok: Closed = {
  'age': 30,
  'name': 'Bastian Balthazar Bux'
};

// additionalProperties: false → excess keys are rejected. `extra` is not among
// Closed's keys, so `{ extra: true, ... }` is a compile error on assignment to
// Closed. Asserted at the type level — no cast, no forced value:
type ExtraIsRejected = 'extra' extends keyof Closed ? false : true;
const extraIsRejected: ExtraIsRejected = true;

console.log('Valid closed object:', ok);
console.log('Closed type permits only:', Object.keys(ok).join(', '));
console.log('Excess key "extra" rejected at compile time:', extraIsRejected);
