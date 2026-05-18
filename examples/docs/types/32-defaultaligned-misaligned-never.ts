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

function assert<T extends true>(): void {
  void 0 as unknown as T;
}

assert<AssertEqualType<MisalignedBook, never>>();

void (null as unknown as MisalignedBook);
