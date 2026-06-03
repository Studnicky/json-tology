/**
 * Parity assertions for the lazy-`TRefs` change (designs/0006 / 0005 §7).
 *
 * Dropping the eager `TMap` generic must NOT lose precision: a string-`$id`
 * `instantiate` / `materialize` on a registered registry must still return the
 * exact branded entity type (the deep `$ref`s resolved), identical to what the
 * former `TMap[K]` produced — never `unknown`. These are compile-time-only
 * assertions; the file passing `tsc` IS the test. The companion deep-registry
 * fixture also drives `npm run test:decl` (the TS2589 declaration-emit guard).
 */

import { deepRegistry } from './declaration-emit/deep-registry.js';

// ---------------------------------------------------------------------------
// Assignability helpers
// ---------------------------------------------------------------------------

type AssertAssignable<TSource, TTarget>
  = [TSource] extends [TTarget] ? true : false;

function assert<T extends true>(): void {
  void 0 as unknown as T;
}

// ---------------------------------------------------------------------------
// Extract the string-id method return types WITHOUT invoking the methods
// (instantiate on `null` data would throw at runtime). The thunks are never
// called; `ReturnType<typeof …>` reads the precise return from the signature.
// ---------------------------------------------------------------------------

const _instantiateRoot = () => {
  return deepRegistry.instantiate('urn:decl:Root', null);
};
const _materializeRoot = () => {
  return deepRegistry.materialize('urn:decl:Root');
};

type Instantiated = ReturnType<typeof _instantiateRoot>;
type Materialized = ReturnType<typeof _materializeRoot>;

// ---------------------------------------------------------------------------
// Parity: string-id instantiate resolves $ref properties to precise (branded)
// leaf types — NOT `unknown`. A plain `unknown` field would FAIL
// `AssertAssignable<field, string>` because `unknown` is not assignable to
// `string`, so each of these compiling proves the lazy form stayed precise.
// ---------------------------------------------------------------------------

// Direct sibling $ref (S01 uuid) → branded string. (`a` is optional on Root, so
// strip the `| undefined` to assert the resolved leaf is a string, not `unknown`.)
assert<AssertAssignable<NonNullable<Instantiated['a']>, string>>();

// Nested object $ref whose own property is itself a $ref (S13.amount → S06) → number.
assert<AssertAssignable<NonNullable<Instantiated['money']>['amount'], number>>();

// Array-of-$ref element (S15 review) → object with a branded numeric rating.
assert<AssertAssignable<NonNullable<Instantiated['reviews']>[number]['rating'], number>>();

// Multi-level $ref chain resolves (Root.deep → L1 → L2.tag), not `unknown`.
assert<AssertAssignable<NonNullable<Instantiated['deep']['child']['tag']>, string>>();

// Required nested entity ($ref S14) present and precise (both `who` and `id` are required).
assert<AssertAssignable<Instantiated['who']['id'], string>>();

// ---------------------------------------------------------------------------
// Parity: string-id materialize returns a precise object (own required/default
// fields), with the same resolved entity type for shared properties.
// ---------------------------------------------------------------------------

assert<AssertAssignable<Materialized['who'], Instantiated['who']>>();
assert<AssertAssignable<Materialized['deep'], Instantiated['deep']>>();
