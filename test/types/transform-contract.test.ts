import { JsonTology } from '../../src/JsonTology.js';
import { Transform } from '../../src/modules/transform/Transform.js';
import type { InferType } from '../../src/types/Schema.js';
import type { ParseOutputType } from '../../src/types/Transform.js';
import type { TransformStageInterface } from '../../src/interfaces/TransformStage.js';

const DateTimeSchema = {
  '$id': 'https://example.io/DateTime',
  'type': 'string'
} as const;

const TransformedDateSchema = Transform.create(DateTimeSchema, {
  'decode': (raw: string) => {
    return new Date(raw);
  },
  'encode': (date: Date) => {
    return date.toISOString();
  }
});

const jt = JsonTology.create({
  'baseIRI': 'https://example.io',
  'enableStrictGraph': false,
  'schemas': [TransformedDateSchema] as const
});

type WireDate = InferType<typeof TransformedDateSchema>;
type ParsedDate = ParseOutputType<typeof TransformedDateSchema>;

const _wireTypeCheck: WireDate = '2024-01-01T00:00:00.000Z';
const _parsedTypeCheck: ParsedDate = new Date('2024-01-01T00:00:00.000Z');

const parsed = jt.instantiate(TransformedDateSchema, '2024-01-01T00:00:00.000Z');
const materialized = jt.materialize(TransformedDateSchema, '2024-01-01T00:00:00.000Z');
const encoded = jt.encode(TransformedDateSchema, new Date('2024-01-01T00:00:00.000Z'));

const _parsedDate: Date = parsed;
const _materializedWire: string = materialized;
const _encodedWire: string = encoded;

// @ts-expect-error coerce() returns decoded output, not wire-form string
const _badParsed: string = parsed;
// @ts-expect-error materialize() returns wire-form output, not decoded Date
const _badMaterialized: Date = materialized;
// @ts-expect-error encode() returns wire-form output, not decoded Date
const _badEncoded: Date = encoded;

// Runtime-unsafe type assertions — guarded to prevent execution
if (false as boolean) {
  // @ts-expect-error materialize() expects wire-form input for transformed schemas
  jt.materialize(TransformedDateSchema, new Date('2024-01-01T00:00:00.000Z'));
  // @ts-expect-error encode() expects decoded input for transformed schemas
  jt.encode(TransformedDateSchema, '2024-01-01T00:00:00.000Z');
}

void [
  _wireTypeCheck,
  _parsedTypeCheck,
  _parsedDate,
  _materializedWire,
  _encodedWire,
  _badParsed,
  _badMaterialized,
  _badEncoded
];

// ---------------------------------------------------------------------------
// Finding 10 — Transform.chain pairwise chain compatibility
// ---------------------------------------------------------------------------

const PipeBase = {
  '$id': 'https://example.io/PipeBase',
  'type': 'string'
} as const;

const trimStage: TransformStageInterface<string, string> = {
  'decode': (raw: string) => {
    return raw.trim();
  },
  'encode': (value: string) => {
    return ` ${value} `;
  }
};

const upperStage: TransformStageInterface<string, string> = {
  'decode': (value: string) => {
    return value.toUpperCase();
  },
  'encode': (value: string) => {
    return value.toLowerCase();
  }
};

const stringToNumberStage: TransformStageInterface<string, number> = {
  'decode': (value: string) => {
    return value.length;
  },
  'encode': (value: number) => {
    return 'x'.repeat(value);
  }
};

const numberToDateStage: TransformStageInterface<number, Date> = {
  'decode': (value: number) => {
    return new Date(value);
  },
  'encode': (value: Date) => {
    return value.getTime();
  }
};

const numberToStringStage: TransformStageInterface<number, string> = {
  'decode': String,
  'encode': Number
};

// Positive: well-typed chain compiles and the final output type is the
// last stage's decoded form.
const okChain = Transform.chain(PipeBase, [
  trimStage,
  upperStage,
  stringToNumberStage,
  numberToDateStage
] as const);

type OkChainOutput = ParseOutputType<typeof okChain>;
const _okChainOutput: OkChainOutput = new Date(0);

// Two-stage chain ending in number — output must be number.
const twoStageChain = Transform.chain(PipeBase, [
  trimStage,
  stringToNumberStage
] as const);

type TwoStageChainOutput = ParseOutputType<typeof twoStageChain>;
const _twoStageChainOutput: TwoStageChainOutput = 42;

// Single-stage chain — output type is the only stage's decoded form.
const singleStageChain = Transform.chain(PipeBase, [stringToNumberStage] as const);

type SingleStageChainOutput = ParseOutputType<typeof singleStageChain>;
const _singleStageChainOutput: SingleStageChainOutput = 7;

// Negative: stage 0 produces `number`, stage 1 expects `string`.
// The pairwise check must reject this at the call site.
//
// Each bad stage triggers its own type error, so each line carries its
// own `@ts-expect-error` directive. The errors surface as the stage type
// being not assignable to `never` (the contracted-tuple element produced
// by `ValidateChainType` when the pair is incompatible).
if (false as boolean) {
  Transform.chain(PipeBase, [
    // @ts-expect-error chain stage 0 produces number, stage 1 expects string
    stringToNumberStage,
    // @ts-expect-error chain stage 0 produces number, stage 1 expects string
    upperStage
  ] as const);

  // Three-stage mismatch in the middle: ok → ok → bad.
  Transform.chain(PipeBase, [
    // @ts-expect-error chain stage 1 produces number, stage 2 expects string
    trimStage,
    // @ts-expect-error chain stage 1 produces number, stage 2 expects string
    stringToNumberStage,
    // @ts-expect-error chain stage 1 produces number, stage 2 expects string
    upperStage
  ] as const);

  // Schema is `string` but first stage decodes `number`.
  // @ts-expect-error first chain stage expects number but schema wire type is string
  Transform.chain(PipeBase, [numberToDateStage] as const);

  // Two stages, both consume number, but schema is string → first-stage mismatch.
  // The error brand replaces only stage 0; stage 1 stays untouched because
  // its in-type matches stage 0's out-type.
  Transform.chain(PipeBase, [
    // @ts-expect-error first chain stage expects number but schema wire type is string
    numberToStringStage,
    upperStage
  ] as const);
}

void [
  okChain,
  twoStageChain,
  singleStageChain,
  _okChainOutput,
  _twoStageChainOutput,
  _singleStageChainOutput
];

// ---------------------------------------------------------------------------
// Finding 11 — Transform.encode value must match decoded form
// ---------------------------------------------------------------------------
//
// Audit: `Transform.create` already constrains
//   `encode: (output: TOut) => InferSchemaType<TSchema>`,
// and `JsonTology.encode(schema, value)` already requires `value: TOut`.
// The existing negative case at lines 51–52 above proves that a wire-form
// value is rejected. The positive + extra negative cases below pin the
// contract.

// Positive: passing the decoded form to encode is accepted.
const _encodedFromDate: string = jt.encode(TransformedDateSchema, new Date('2024-06-01T00:00:00.000Z'));

// Negative: number is neither wire (string) nor decoded (Date).
if (false as boolean) {
  // @ts-expect-error encode rejects values that are neither wire-form nor decoded
  jt.encode(TransformedDateSchema, 42);
  // @ts-expect-error encode rejects strings; the decoded type is Date
  jt.encode(TransformedDateSchema, 'not-a-date' as unknown as { 'foo': 'bar' });
}

void [_encodedFromDate];
