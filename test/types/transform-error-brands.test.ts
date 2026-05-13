/**
 * Compile-time identity assertions for Transform chain error brands.
 *
 * For each named chain-error brand, verifies that:
 * 1. The brand interface has the expected structural shape.
 * 2. A Transform.chain call that triggers the error condition is rejected.
 * 3. A well-typed chain compiles without errors.
 */

import {
  describe, it
} from 'node:test';

import { Transform } from '../../src/modules/transform/Transform.js';
import type {
  ChainMismatchInterface,
  ChainSchemaMismatchInterface
} from '../../src/types/TypeErrors.js';
import type { TransformStageInterface } from '../../src/interfaces/TransformStage.js';

// ---------------------------------------------------------------------------
// Bidirectional equality helper
// ---------------------------------------------------------------------------

type AssertEqualType<TLeft, TRight>
  = [TLeft] extends [TRight] ? [TRight] extends [TLeft] ? true : false : false;

function assert<T extends true>(): void {
  void 0 as unknown as T;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const StringSchema = {
  '$id': 'https://example.io/Str',
  'type': 'string'
} as const;

const stringToNumber: TransformStageInterface<string, number> = {
  'decode': (raw: string) => {
    return raw.length;
  },
  'encode': (count: number) => {
    return 'x'.repeat(count);
  }
};

const numberToDate: TransformStageInterface<number, Date> = {
  'decode': (timestamp: number) => {
    return new Date(timestamp);
  },
  'encode': (date: Date) => {
    return date.getTime();
  }
};

const numberToString: TransformStageInterface<number, string> = {
  'decode': String,
  'encode': Number
};

const stringToString: TransformStageInterface<string, string> = {
  'decode': (raw: string) => {
    return raw.trim();
  },
  'encode': (trimmed: string) => {
    return trimmed;
  }
};

// ---------------------------------------------------------------------------
// Brand B1: ChainMismatchInterface — stage output ≠ next stage input
// ---------------------------------------------------------------------------

// Brand structural identity: carries kind, stageIndex, producedByPriorStage, expectedByThisStage
assert<AssertEqualType<ChainMismatchInterface<0, string, number>['kind'], 'ChainMismatch'>>();

assert<AssertEqualType<ChainMismatchInterface<0, string, number>['stageIndex'], 0>>();

assert<AssertEqualType<ChainMismatchInterface<0, string, number>['producedByPriorStage'], string>>();

assert<AssertEqualType<ChainMismatchInterface<0, string, number>['expectedByThisStage'], number>>();

// Positive: well-typed chain compiles
const _okChain = Transform.chain(StringSchema, [
  stringToNumber,
  numberToDate
] as const);

void _okChain;

// Negative: stage 0 produces number, stage 1 expects string
// Each bad stage emits its own error so each carries @ts-expect-error
if (false as boolean) {
  Transform.chain(StringSchema, [
    // @ts-expect-error — stage 0 produces number, stage 1 expects string (ChainMismatchInterface)
    stringToNumber,
    // @ts-expect-error — stage 0 produces number, stage 1 expects string (ChainMismatchInterface)
    stringToString
  ] as const);
}

// Negative: three-stage chain — mismatch at position 1
if (false as boolean) {
  Transform.chain(StringSchema, [
    // @ts-expect-error — stage 1 produces number, stage 2 expects string (ChainMismatchInterface)
    stringToString,
    // @ts-expect-error — stage 1 produces number, stage 2 expects string (ChainMismatchInterface)
    stringToNumber,
    // @ts-expect-error — stage 1 produces number, stage 2 expects string (ChainMismatchInterface)
    stringToString
  ] as const);
}

// ---------------------------------------------------------------------------
// Brand B2: ChainSchemaMismatchInterface — first stage input ≠ schema wire type
// ---------------------------------------------------------------------------

// Brand structural identity: carries kind, schemaWireType, firstStageDecodeInput
assert<AssertEqualType<ChainSchemaMismatchInterface<string, number>['kind'], 'ChainSchemaMismatch'>>();

assert<AssertEqualType<ChainSchemaMismatchInterface<string, number>['schemaWireType'], string>>();

assert<AssertEqualType<ChainSchemaMismatchInterface<string, number>['firstStageDecodeInput'], number>>();

// Positive: first stage input matches schema wire type (string → string is fine)
const _schemaMismatchOk = Transform.chain(StringSchema, [stringToNumber] as const);

void _schemaMismatchOk;

// Negative: schema is string but first stage expects number
if (false as boolean) {
  // @ts-expect-error — schema wire type is string, first stage expects number (ChainSchemaMismatchInterface)
  Transform.chain(StringSchema, [numberToDate] as const);
}

// Negative: schema is string but first stage consumes number — two-stage case
if (false as boolean) {
  Transform.chain(StringSchema, [
    // @ts-expect-error — schema wire type is string, first stage expects number (ChainSchemaMismatchInterface)
    numberToString,
    stringToNumber
  ] as const);
}

// ---------------------------------------------------------------------------
// Suppress unused warnings
// ---------------------------------------------------------------------------

void [
  stringToNumber,
  numberToDate,
  numberToString,
  stringToString
];

void describe('transform error brands (compile-time only)', () => {
  void it('compiles', () => {
    void 0;
  });
});
