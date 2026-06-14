/**
 * Compile-time identity assertions for OWL 2 property-characteristic conflict brands.
 *
 * For each hard-conflict pair, verifies that:
 * 1. The brand interface has the expected structural shape.
 * 2. A schema that triggers the conflict is rejected at compile time via
 *    ValidatePropertyCharacteristicsType.
 * 3. A schema with a single characteristic or a non-conflicting pair compiles.
 *
 * All scenarios are compile-time only — no runtime assertions.
 */

import {
  describe, it
} from 'node:test';

import type {
  PropertyCharacteristicConflictType,
  ValidatePropertyCharacteristicsType
} from '../../src/types/TypeErrors.js';

// ---------------------------------------------------------------------------
// Bidirectional equality helper
// ---------------------------------------------------------------------------

type AssertEqualType<TLeft, TRight>
  = [TLeft] extends [TRight] ? [TRight] extends [TLeft] ? true : false : false;

function assert<T extends true>(): void {
  void 0 as unknown as T;
}

// ---------------------------------------------------------------------------
// Brand F: PropertyCharacteristicConflictType — structural identity
// ---------------------------------------------------------------------------

assert<AssertEqualType<
  PropertyCharacteristicConflictType<'relates', readonly ['symmetric', 'asymmetric']>['kind'],
  'PropertyCharacteristicConflict'
>>();

assert<AssertEqualType<
  PropertyCharacteristicConflictType<'relates', readonly ['symmetric', 'asymmetric']>['property'],
  'relates'
>>();

assert<AssertEqualType<
  PropertyCharacteristicConflictType<'relates', readonly ['symmetric', 'asymmetric']>['conflicts'],
  readonly ['symmetric', 'asymmetric']
>>();

// ---------------------------------------------------------------------------
// Positive: single characteristics — each compiles fine
// ---------------------------------------------------------------------------

const _symmetricOnly = {
  '$id': 'urn:test:SymOnly',
  'properties': { 'rel': { 'symmetric': true } },
  'type': 'object'
} as const;

const _ok1: ValidatePropertyCharacteristicsType<typeof _symmetricOnly> = _symmetricOnly;

void _ok1;

const _asymmetricOnly = {
  '$id': 'urn:test:AsymOnly',
  'properties': { 'rel': { 'asymmetric': true } },
  'type': 'object'
} as const;

const _ok2: ValidatePropertyCharacteristicsType<typeof _asymmetricOnly> = _asymmetricOnly;

void _ok2;

const _reflexiveOnly = {
  '$id': 'urn:test:ReflOnly',
  'properties': { 'rel': { 'reflexive': true } },
  'type': 'object'
} as const;

const _ok3: ValidatePropertyCharacteristicsType<typeof _reflexiveOnly> = _reflexiveOnly;

void _ok3;

const _irreflexiveOnly = {
  '$id': 'urn:test:IrrOnly',
  'properties': { 'rel': { 'irreflexive': true } },
  'type': 'object'
} as const;

const _ok4: ValidatePropertyCharacteristicsType<typeof _irreflexiveOnly> = _irreflexiveOnly;

void _ok4;

const _transitiveOnly = {
  '$id': 'urn:test:TransOnly',
  'properties': { 'rel': { 'transitive': true } },
  'type': 'object'
} as const;

const _ok5: ValidatePropertyCharacteristicsType<typeof _transitiveOnly> = _transitiveOnly;

void _ok5;

const _functionalOnly = {
  '$id': 'urn:test:FuncOnly',
  'properties': { 'rel': { 'functional': true } },
  'type': 'object'
} as const;

const _ok6: ValidatePropertyCharacteristicsType<typeof _functionalOnly> = _functionalOnly;

void _ok6;

// ---------------------------------------------------------------------------
// Positive: non-conflicting pairs — all compile fine
// ---------------------------------------------------------------------------

// symmetric + reflexive is valid (SimilarBook pattern)
const _symRefl = {
  '$id': 'urn:test:SymRefl',
  'properties': {
    'rel': {
      'reflexive': true,
      'symmetric': true
    }
  },
  'type': 'object'
} as const;

const _ok7: ValidatePropertyCharacteristicsType<typeof _symRefl> = _symRefl;

void _ok7;

// transitive + irreflexive is valid (Order.placedAt pattern)
const _transIrr = {
  '$id': 'urn:test:TransIrr',
  'properties': {
    'rel': {
      'irreflexive': true,
      'transitive': true
    }
  },
  'type': 'object'
} as const;

const _ok8: ValidatePropertyCharacteristicsType<typeof _transIrr> = _transIrr;

void _ok8;

// functional + inverseFunctional is structurally valid (not a hard conflict)
const _funcInvFunc = {
  '$id': 'urn:test:FuncInvFunc',
  'properties': {
    'rel': {
      'functional': true,
      'inverseFunctional': true
    }
  },
  'type': 'object'
} as const;

const _ok9: ValidatePropertyCharacteristicsType<typeof _funcInvFunc> = _funcInvFunc;

void _ok9;

// asymmetric alone (without reflexive) is valid
const _asymOnly = {
  '$id': 'urn:test:AsymAlone',
  'properties': { 'rel': { 'asymmetric': true } },
  'type': 'object'
} as const;

const _ok10: ValidatePropertyCharacteristicsType<typeof _asymOnly> = _asymOnly;

void _ok10;

// ---------------------------------------------------------------------------
// Negative: Conflict 1 — symmetric + asymmetric
// ---------------------------------------------------------------------------

// @ts-expect-error — 'relates' sets symmetric:true and asymmetric:true (PropertyCharacteristicConflictType)
const _badSymAsym: ValidatePropertyCharacteristicsType<{
  readonly '$id': 'urn:test:Bad1';
  readonly 'properties': {
    readonly 'relates': { readonly 'asymmetric': true;
      readonly 'symmetric': true };
  };
  readonly 'type': 'object';
}> = {
  '$id': 'urn:test:Bad1',
  'properties': {
    'relates': {
      'asymmetric': true,
      'symmetric': true
    }
  },
  'type': 'object'
} as const;

void _badSymAsym;

// ---------------------------------------------------------------------------
// Negative: Conflict 2 — reflexive + irreflexive
// ---------------------------------------------------------------------------

// @ts-expect-error — 'rel' sets reflexive:true and irreflexive:true (PropertyCharacteristicConflictType)
const _badReflIrr: ValidatePropertyCharacteristicsType<{
  readonly '$id': 'urn:test:Bad2';
  readonly 'properties': {
    readonly 'rel': { readonly 'irreflexive': true;
      readonly 'reflexive': true };
  };
  readonly 'type': 'object';
}> = {
  '$id': 'urn:test:Bad2',
  'properties': {
    'rel': {
      'irreflexive': true,
      'reflexive': true
    }
  },
  'type': 'object'
} as const;

void _badReflIrr;

// ---------------------------------------------------------------------------
// Negative: Conflict 3 — asymmetric + reflexive
// ---------------------------------------------------------------------------

// @ts-expect-error — 'edge' sets asymmetric:true and reflexive:true (PropertyCharacteristicConflictType)
const _badAsymRefl: ValidatePropertyCharacteristicsType<{
  readonly '$id': 'urn:test:Bad3';
  readonly 'properties': {
    readonly 'edge': { readonly 'asymmetric': true;
      readonly 'reflexive': true };
  };
  readonly 'type': 'object';
}> = {
  '$id': 'urn:test:Bad3',
  'properties': {
    'edge': {
      'asymmetric': true,
      'reflexive': true
    }
  },
  'type': 'object'
} as const;

void _badAsymRefl;

// ---------------------------------------------------------------------------
// Suppress unused variable warnings
// ---------------------------------------------------------------------------

void [
  _symmetricOnly,
  _asymmetricOnly,
  _reflexiveOnly,
  _irreflexiveOnly,
  _transitiveOnly,
  _functionalOnly,
  _symRefl,
  _transIrr,
  _funcInvFunc,
  _asymOnly
];

void describe('property characteristic conflict brands (compile-time only)', () => {
  void it('compiles', () => {
    void 0;
  });
});
