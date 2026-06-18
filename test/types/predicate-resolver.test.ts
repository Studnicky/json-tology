/**
 * Compile-time shape assertions for PredicateResolverFnType.
 *
 * Verifies that the resolver function type:
 *   1. Accepts a ctx object with readonly classId, propertyName, and a
 *      JsonSchemaType propertySchema.
 *   2. Returns a string (a full IRI or CURIE, expanded later).
 *
 * All scenarios are compile-time only — no runtime assertions.
 */

import {
  describe, it
} from 'node:test';

import type { JsonSchemaType } from '../../src/types/Schema.js';
import type { PredicateResolverFnType } from '../../src/types/PredicateResolverFnType.js';

// ---------------------------------------------------------------------------
// Bidirectional equality helper
// ---------------------------------------------------------------------------

type AssertEqualType<TLeft, TRight>
  = [TLeft] extends [TRight] ? [TRight] extends [TLeft] ? true : false : false;

function assert<T extends true>(): void {
  void 0 as unknown as T;
}

// ---------------------------------------------------------------------------
// Return type is string
// ---------------------------------------------------------------------------

assert<AssertEqualType<ReturnType<PredicateResolverFnType>, string>>();

// ---------------------------------------------------------------------------
// Parameter is the expected ctx shape
// ---------------------------------------------------------------------------

type CtxType = Parameters<PredicateResolverFnType>[0];

assert<AssertEqualType<CtxType['classId'], string>>();
assert<AssertEqualType<CtxType['propertyName'], string>>();
assert<AssertEqualType<CtxType['propertySchema'], JsonSchemaType>>();

// ---------------------------------------------------------------------------
// A conforming implementation type-checks and is assignable
// ---------------------------------------------------------------------------

const _impl: PredicateResolverFnType = (ctx) => {
  return `${ctx.classId}#${ctx.propertyName}`;
};

void _impl;

// node:test wrapper so the file is a valid test module
void describe('PredicateResolverFnType — compile-time shape', () => {
  void it('asserts at compile time', () => {
    void 0;
  });
});
