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

// Positive: well-typed chain — decodes string → number → string (canonical).
const _okChain = Transform.chain(StringSchema, [
  stringToNumber,
  numberToString
] as const);

void _okChain;

// Negative: stage 0 produces number, stage 1 expects string. The validator
// inserts ChainMismatchInterface<0, number, string> at the broken position —
// assert that exact brand, not merely that the chain fails to compile.
type TwoStageInteriorMismatch = ValidateChainType<readonly [typeof stringToNumber, typeof stringToString], string>;
assert<AssertEqualType<TwoStageInteriorMismatch[1], ChainMismatchInterface<0, number, string>>>();

// Negative: three-stage chain — mismatch at index 1 (stage 1 produces number,
// stage 2 expects string).
type ThreeStageInteriorMismatch = ValidateChainType<readonly [typeof stringToString, typeof stringToNumber, typeof stringToString], string>;
assert<AssertEqualType<ThreeStageInteriorMismatch[2], ChainMismatchInterface<1, number, string>>>();

// ---------------------------------------------------------------------------
// Brand B2: ChainSchemaMismatchInterface — last stage output ≠ schema canonical type
// ---------------------------------------------------------------------------

// Brand structural identity: carries kind, schemaCanonicalType, lastStageDecodeOutput
assert<AssertEqualType<ChainSchemaMismatchInterface<string, number>['kind'], 'ChainSchemaMismatch'>>();

assert<AssertEqualType<ChainSchemaMismatchInterface<string, number>['schemaCanonicalType'], string>>();

assert<AssertEqualType<ChainSchemaMismatchInterface<string, number>['lastStageDecodeOutput'], number>>();

// Positive: last stage output matches the schema's canonical type (string).
const _schemaMismatchOk = Transform.chain(StringSchema, [stringToString] as const);

void _schemaMismatchOk;

// Negative: last stage produces number, canonical is string. The validator
// replaces the tail with ChainSchemaMismatchInterface<string, number> — assert it.
type TailNumberMismatch = ValidateChainType<readonly [typeof stringToNumber], string>;
assert<AssertEqualType<TailNumberMismatch[0], ChainSchemaMismatchInterface<string, number>>>();

// Negative: last stage produces Date, canonical is string —
// ChainSchemaMismatchInterface<string, Date>.
type TailDateMismatch = ValidateChainType<readonly [typeof numberToDate], string>;
assert<AssertEqualType<TailDateMismatch[0], ChainSchemaMismatchInterface<string, Date>>>();

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
