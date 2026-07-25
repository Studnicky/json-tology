/**
 * Compile-time shape assertions for PredicateResolverFunctionType.
 *
 * Verifies that the resolver function type:
 *   1. Accepts a context object with readonly classId, propertyName, and a
 *      JsonSchemaType propertySchema.
 *   2. Returns a string (a full IRI or CURIE, expanded later).
 *
 * All scenarios are compile-time only — no runtime assertions.
 */

import {
  describe, it
} from 'node:test';

import type { JsonSchemaType } from '../../src/types/Schema.js';
import type { PredicateResolverFunctionType } from '../../src/types/PredicateResolverFunctionType.js';

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

assert<AssertEqualType<ReturnType<PredicateResolverFunctionType>, string>>();

// ---------------------------------------------------------------------------
// Parameter is the expected context shape
// ---------------------------------------------------------------------------

type ContextType = Parameters<PredicateResolverFunctionType>[0];

assert<AssertEqualType<ContextType['classId'], string>>();
assert<AssertEqualType<ContextType['propertyName'], string>>();
assert<AssertEqualType<ContextType['propertySchema'], JsonSchemaType>>();

// ---------------------------------------------------------------------------
// A conforming implementation type-checks and is assignable
// ---------------------------------------------------------------------------

const _impl: PredicateResolverFunctionType = (context) => {
  return `${context.classId}#${context.propertyName}`;
};

void _impl;

// node:test wrapper so the file is a valid test module
void describe('PredicateResolverFunctionType — compile-time shape', () => {
  void it('asserts at compile time', () => {
    void 0;
  });
});
