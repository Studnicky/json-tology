/**
 * Compile-time assertions for `$id` duplicate detection in `UniqueSchemaIdsType`.
 *
 * The detector folds the schema tuple in chunks so it scales to large
 * registries without exceeding TypeScript's instantiation ceiling. These
 * assertions guard that it still (a) leaves a unique tuple unchanged and
 * (b) transforms (brands) a tuple containing a duplicated `$id`.
 *
 * Compile-time correctness is validated by `npm run type-check:tests`; the
 * node:test block keeps the file runnable under `npm run test:types`.
 */
import {
  describe, it
} from 'node:test';

import type { UniqueSchemaIdsType } from '../../src/types/Registry.js';

type EqualType<TA, TB>
  = (<T>() => T extends TA ? 1 : 2) extends (<T>() => T extends TB ? 1 : 2) ? true : false;
type ExpectTrue<T extends true> = T;

type UniquePair = readonly [
  { readonly '$id': 'urn:a' },
  { readonly '$id': 'urn:b' }
];
type DuplicatePair = readonly [
  { readonly '$id': 'urn:a' },
  { readonly '$id': 'urn:a' }
];

// A unique tuple passes through unchanged.
type UniqueUnchangedAssertion = ExpectTrue<EqualType<UniqueSchemaIdsType<UniquePair>, UniquePair>>;

// A tuple with a duplicated `$id` is transformed (branded), so it is NOT equal
// to the raw input tuple. If detection regresses to a no-op, this assertion
// fails to compile.
type DuplicateBrandedAssertion
  = ExpectTrue<EqualType<UniqueSchemaIdsType<DuplicatePair>, DuplicatePair> extends true ? false : true>;

// Reference both assertions without a cast: each resolves to `true`, so the
// `satisfies` checks compile only if the duplicate detector is correct.
void (true satisfies UniqueUnchangedAssertion);
void (true satisfies DuplicateBrandedAssertion);

void describe('UniqueSchemaIdsType — $id duplicate detection', () => {
  void it('is validated at compile time (see type assertions above)', () => {
    void 0;
  });
});
