/**
 * DefaultAlignedType — Example 2: A misaligned default resolves to
 * `never`.
 *
 * `currency` declares `type: 'string'` but provides `default: 42`.
 * DefaultAlignedType detects the mismatch at compile time and resolves
 * to `never`, marking the schema as not safe to consume directly.
 */

import type { DefaultAlignedType } from '../../../src/types/index.js';

const _BadSchema = {
  'properties': {
    'currency': {
      'default': 42,
      'type': 'string'
    }
  },
  'type': 'object'
} as const;

type MisalignedBook = DefaultAlignedType<typeof _BadSchema>;
// never — default 42 is not assignable to 'string'.

// Compile-time assertion: MisalignedBook is `never`.
type AssertEqualType<TLeft, TRight>
  = [TLeft] extends [TRight] ? [TRight] extends [TLeft] ? true : false : false;

function assert<T extends true>(_proof?: T): void {
  return;
}

assert<AssertEqualType<MisalignedBook, never>>();

// MisalignedBook resolves to never at compile time: the schema has
// default: 42 for a property declared type: 'string', which is a mismatch.
// At runtime the schema object still exists; the guard only affects the type.
console.log('schema type property:', _BadSchema.properties.currency.type);
console.log('schema default (mismatched):', _BadSchema.properties.currency.default);
