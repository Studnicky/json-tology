/**
 * Anti-pattern: Relying solely on runtime to catch misaligned
 * defaults.
 *
 * Registering a misaligned schema raises a runtime error — but the
 * mismatch is detectable at compile time. Wrap registration in a
 * helper constrained by `DefaultAlignedType<T>` and the misalignment
 * surfaces in the editor before it ever reaches `set()`.
 */

import type { DefaultAlignedType } from '../../../src/types/index.js';

const _BadSchema = {
  '$id': 'https://bookstore.example/BadBook',
  'properties': {
    'currency': {
      'default': 42,
      'type': 'string'
    }
  },
  'type': 'object'
} as const;

// ⊥ Don't do this — runtime-only detection.
// jt.set(_BadSchema); // throws at registration time

// ✓ Do this — catch the misalignment at compile time.
type GuardedBadSchema = DefaultAlignedType<typeof _BadSchema>;
// never — DefaultAlignedType refuses the misaligned schema.

type AssertEqualType<TLeft, TRight>
  = [TLeft] extends [TRight] ? [TRight] extends [TLeft] ? true : false : false;

function assert<T extends true>(_proof?: T): void {
  return;
}

assert<AssertEqualType<GuardedBadSchema, never>>();

// GuardedBadSchema resolves to never: default 42 is incompatible with
// type 'string'. The schema object still exists at runtime; the guard
// prevents it from reaching a registration function without compile error.
console.log('schema $id:', _BadSchema.$id);
console.log('problematic default (42, type string):', _BadSchema.properties.currency.default);
