/**
 * Compile-time identity assertions for Transform chain error brands.
 *
 * For each named chain-error brand, verifies that:
 * 1. The brand interface has the expected structural shape.
 * 2. A Transform.chain call that triggers the error condition is rejected.
 * 3. A well-typed chain compiles without errors.
 *
 * A normalize chain decodes the raw wire type (the FIRST stage's free input)
 * into the schema's canonical form (the LAST stage's output). The head input
 * is unconstrained; the tail output is anchored to the schema's canonical type.
 */

import {
  describe, it
} from 'node:test';

import { Transform } from '../../src/modules/transform/Transform.js';
import type { ValidateChainType } from '../../src/types/Transform.js';
import type {
  ChainMismatchType,
  ChainSchemaMismatchType
} from '../../src/types/TypeErrors.js';
import type { TransformStageType } from '../../src/types/TransformStage.js';

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

const stringToNumber: TransformStageType<string, number> = {
  'decode': (raw: string) => {
    return raw.length;
  },
  'encode': (count: number) => {
    return 'x'.repeat(count);
  }
};

const numberToDate: TransformStageType<number, Date> = {
  'decode': (timestamp: number) => {
    return new Date(timestamp);
  },
  'encode': (date: Date) => {
    return date.getTime();
  }
};

const numberToString: TransformStageType<number, string> = {
  'decode': String,
  'encode': Number
};

const stringToString: TransformStageType<string, string> = {
  'decode': (raw: string) => {
    return raw.trim();
  },
  'encode': (trimmed: string) => {
    return trimmed;
  }
};

// ---------------------------------------------------------------------------
// Brand B1: ChainMismatchType — stage output ≠ next stage input
// ---------------------------------------------------------------------------

// Brand structural identity: carries kind, stageIndex, producedByPriorStage, expectedByThisStage
assert<AssertEqualType<ChainMismatchType<0, string, number>['kind'], 'ChainMismatch'>>();

assert<AssertEqualType<ChainMismatchType<0, string, number>['stageIndex'], 0>>();

assert<AssertEqualType<ChainMismatchType<0, string, number>['producedByPriorStage'], string>>();

assert<AssertEqualType<ChainMismatchType<0, string, number>['expectedByThisStage'], number>>();

// Positive: well-typed chain — decodes string → number → string (canonical).
const _okChain = Transform.chain(StringSchema, [
  stringToNumber,
  numberToString
] as const);

void _okChain;

// Negative: stage 0 produces number, stage 1 expects string. The validator
// inserts ChainMismatchType<0, number, string> at the broken position —
// assert that exact brand, not merely that the chain fails to compile.
type TwoStageInteriorMismatch = ValidateChainType<[typeof stringToNumber, typeof stringToString], string>;
assert<AssertEqualType<TwoStageInteriorMismatch[1], ChainMismatchType<0, number, string>>>();

// Negative: three-stage chain — mismatch at index 1 (stage 1 produces number,
// stage 2 expects string).
type ThreeStageInteriorMismatch = ValidateChainType<[typeof stringToString, typeof stringToNumber, typeof stringToString], string>;
assert<AssertEqualType<ThreeStageInteriorMismatch[2], ChainMismatchType<1, number, string>>>();

// ---------------------------------------------------------------------------
// Brand B2: ChainSchemaMismatchType — last stage output ≠ schema canonical type
// ---------------------------------------------------------------------------

// Brand structural identity: carries kind, schemaCanonicalType, lastStageDecodeOutput
assert<AssertEqualType<ChainSchemaMismatchType<string, number>['kind'], 'ChainSchemaMismatch'>>();

assert<AssertEqualType<ChainSchemaMismatchType<string, number>['schemaCanonicalType'], string>>();

assert<AssertEqualType<ChainSchemaMismatchType<string, number>['lastStageDecodeOutput'], number>>();

// Positive: last stage output matches the schema's canonical type (string).
const _schemaMismatchOk = Transform.chain(StringSchema, [stringToString] as const);

void _schemaMismatchOk;

// Negative: last stage produces number, canonical is string. The validator
// replaces the tail with ChainSchemaMismatchType<string, number> — assert it.
type TailNumberMismatch = ValidateChainType<[typeof stringToNumber], string>;
assert<AssertEqualType<TailNumberMismatch[0], ChainSchemaMismatchType<string, number>>>();

// Negative: last stage produces Date, canonical is string —
// ChainSchemaMismatchType<string, Date>.
type TailDateMismatch = ValidateChainType<[typeof numberToDate], string>;
assert<AssertEqualType<TailDateMismatch[0], ChainSchemaMismatchType<string, Date>>>();

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
