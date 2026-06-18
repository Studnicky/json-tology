/**
 * Round-trip type identity assertions.
 *
 * The single most important type guarantee of json-tology:
 *   typeof jt.instantiate(Schema.$id, data) === InferType<typeof Schema>
 *
 * For each major schema kind, asserts that the compile-time return type of
 * `jt.instantiate` is exactly equal to `InferType<typeof Schema>`. Any
 * divergence here means the published type contract is broken.
 *
 * Eight schema kinds covered:
 *   1. Object with required/optional properties
 *   2. Array with item type
 *   3. String
 *   4. Number
 *   5. Integer
 *   6. Boolean
 *   7. Enum
 *   8. Const
 *   9. Discriminated union (via Compose.discriminatedUnion)
 *   10. Transformed schema (decoded type differs from wire type)
 */

import {
  describe, it
} from 'node:test';

import { JsonTology } from '../../src/JsonTology.js';
import { Transform } from '../../src/modules/transform/Transform.js';
import { Compose } from '../../src/modules/composition/Compose.js';
import type { InferType } from '../../src/types/Schema.js';
import type { ParseOutputType } from '../../src/types/Transform.js';

// ---------------------------------------------------------------------------
// Bidirectional equality helper
// ---------------------------------------------------------------------------

type AssertEqualType<TLeft, TRight>
  = [TLeft] extends [TRight] ? [TRight] extends [TLeft] ? true : false : false;

function assert<T extends true>(): void {
  void 0 as unknown as T;
}

// ---------------------------------------------------------------------------
// Scenario 1: Object schema
// ---------------------------------------------------------------------------

const ObjectSchema = {
  '$id': 'https://rt.test/Object',
  'properties': {
    'age': { 'type': 'number' },
    'name': { 'type': 'string' }
  },
  'required': ['name'],
  'type': 'object'
} as const;

type ObjectExpected = InferType<typeof ObjectSchema>;

const jtObject = JsonTology.create({
  'baseIri': 'https://rt.test',
  'enableStrictGraph': false,
  'schemas': [ObjectSchema] as const
});

const _objectResult = jtObject.instantiate('https://rt.test/Object', { 'name': 'Alice' });

assert<AssertEqualType<typeof _objectResult, ObjectExpected>>();

void _objectResult;

// ---------------------------------------------------------------------------
// Scenario 2: Array schema
// ---------------------------------------------------------------------------

const ArraySchema = {
  '$id': 'https://rt.test/Array',
  'items': { 'type': 'string' },
  'type': 'array'
} as const;

type ArrayExpected = InferType<typeof ArraySchema>;

const jtArray = JsonTology.create({
  'baseIri': 'https://rt.test',
  'enableStrictGraph': false,
  'schemas': [ArraySchema] as const
});

const _arrayResult = jtArray.instantiate('https://rt.test/Array', [
  'a',
  'b'
]);

type ArrayRoundTrip = AssertEqualType<typeof _arrayResult, ArrayExpected>;
assert<ArrayRoundTrip>();

void _arrayResult;

// ---------------------------------------------------------------------------
// Scenario 3: String schema
// ---------------------------------------------------------------------------

const StringSchema = {
  '$id': 'https://rt.test/String',
  'type': 'string'
} as const;

type StringExpected = InferType<typeof StringSchema>;

const jtString = JsonTology.create({
  'baseIri': 'https://rt.test',
  'enableStrictGraph': false,
  'schemas': [StringSchema] as const
});

const _stringResult = jtString.instantiate('https://rt.test/String', 'hello');

type StringRoundTrip = AssertEqualType<typeof _stringResult, StringExpected>;
assert<StringRoundTrip>();

void _stringResult;

// ---------------------------------------------------------------------------
// Scenario 4: Number schema
// ---------------------------------------------------------------------------

const NumberSchema = {
  '$id': 'https://rt.test/Number',
  'type': 'number'
} as const;

type NumberExpected = InferType<typeof NumberSchema>;

const jtNumber = JsonTology.create({
  'baseIri': 'https://rt.test',
  'enableStrictGraph': false,
  'schemas': [NumberSchema] as const
});

const _numberResult = jtNumber.instantiate('https://rt.test/Number', 3.14);

type NumberRoundTrip = AssertEqualType<typeof _numberResult, NumberExpected>;
assert<NumberRoundTrip>();

void _numberResult;

// ---------------------------------------------------------------------------
// Scenario 5: Integer schema
// ---------------------------------------------------------------------------

const IntegerSchema = {
  '$id': 'https://rt.test/Integer',
  'type': 'integer'
} as const;

type IntegerExpected = InferType<typeof IntegerSchema>;

const jtInteger = JsonTology.create({
  'baseIri': 'https://rt.test',
  'enableStrictGraph': false,
  'schemas': [IntegerSchema] as const
});

const _integerResult = jtInteger.instantiate('https://rt.test/Integer', 42);

type IntegerRoundTrip = AssertEqualType<typeof _integerResult, IntegerExpected>;
assert<IntegerRoundTrip>();

void _integerResult;

// ---------------------------------------------------------------------------
// Scenario 6: Boolean schema
// ---------------------------------------------------------------------------

const BooleanSchema = {
  '$id': 'https://rt.test/Boolean',
  'type': 'boolean'
} as const;

type BooleanExpected = InferType<typeof BooleanSchema>;

const jtBoolean = JsonTology.create({
  'baseIri': 'https://rt.test',
  'enableStrictGraph': false,
  'schemas': [BooleanSchema] as const
});

const _booleanResult = jtBoolean.instantiate('https://rt.test/Boolean', true);

type BooleanRoundTrip = AssertEqualType<typeof _booleanResult, BooleanExpected>;
assert<BooleanRoundTrip>();

void _booleanResult;

// ---------------------------------------------------------------------------
// Scenario 7: Enum schema
// ---------------------------------------------------------------------------

const EnumSchema = {
  '$id': 'https://rt.test/Enum',
  'enum': [
    'red',
    'green',
    'blue'
  ]
} as const;

type EnumExpected = InferType<typeof EnumSchema>;

const jtEnum = JsonTology.create({
  'baseIri': 'https://rt.test',
  'enableStrictGraph': false,
  'schemas': [EnumSchema] as const
});

const _enumResult = jtEnum.instantiate('https://rt.test/Enum', 'red');

type EnumRoundTrip = AssertEqualType<typeof _enumResult, EnumExpected>;
assert<EnumRoundTrip>();

void _enumResult;

// ---------------------------------------------------------------------------
// Scenario 8: Const schema
// ---------------------------------------------------------------------------

const ConstSchema = {
  '$id': 'https://rt.test/Const',
  'const': 'singleton'
} as const;

type ConstExpected = InferType<typeof ConstSchema>;

const jtConst = JsonTology.create({
  'baseIri': 'https://rt.test',
  'enableStrictGraph': false,
  'schemas': [ConstSchema] as const
});

const _constResult = jtConst.instantiate('https://rt.test/Const', 'singleton');

type ConstRoundTrip = AssertEqualType<typeof _constResult, ConstExpected>;
assert<ConstRoundTrip>();

void _constResult;

// ---------------------------------------------------------------------------
// Scenario 9: Discriminated union (via Compose.discriminatedUnion)
// ---------------------------------------------------------------------------

const CircleSchema = {
  '$id': 'https://rt.test/Circle',
  'properties': {
    'kind': { 'const': 'circle' },
    'radius': { 'type': 'number' }
  },
  'required': [
    'kind',
    'radius'
  ],
  'type': 'object'
} as const;

const RectSchema = {
  '$id': 'https://rt.test/Rect',
  'properties': {
    'height': { 'type': 'number' },
    'kind': { 'const': 'rect' },
    'width': { 'type': 'number' }
  },
  'required': [
    'kind',
    'width',
    'height'
  ],
  'type': 'object'
} as const;

const ShapeSchema = Compose.discriminatedUnion(
  'kind',
  [
    CircleSchema,
    RectSchema
  ] as const,
  'https://rt.test/Shape'
);

type ShapeExpected = InferType<typeof ShapeSchema>;

const jtShape = JsonTology.create({
  'baseIri': 'https://rt.test',
  'enableStrictGraph': false,
  'schemas': [
    CircleSchema,
    RectSchema,
    ShapeSchema
  ] as const
});

const _shapeResult = jtShape.instantiate('https://rt.test/Shape', {
  'kind': 'circle',
  'radius': 5
});

type ShapeRoundTrip = AssertEqualType<typeof _shapeResult, ShapeExpected>;
assert<ShapeRoundTrip>();

void _shapeResult;

// ---------------------------------------------------------------------------
// Scenario 10: Normalize transform (raw wire type ≠ canonical schema type)
// ---------------------------------------------------------------------------

const RawDateSchema = {
  '$id': 'https://rt.test/Date',
  'type': 'string'
} as const;

// decode normalizes a raw `{ epoch }` wire payload into the schema's canonical
// string form; encode is the inverse. The schema describes decode's OUTPUT.
const TransformedDateSchema = Transform.create(RawDateSchema, {
  'decode': (raw: { 'epoch': number }) => {
    return new Date(raw.epoch).toISOString();
  },
  'encode': (iso: string) => {
    return { 'epoch': new Date(iso).getTime() };
  }
});

// For Transform schemas, ParseOutputType gives the canonical (schema) type.
type TransformedExpected = ParseOutputType<typeof TransformedDateSchema>;

const jtDate = JsonTology.create({
  'baseIri': 'https://rt.test',
  'enableStrictGraph': false,
  'schemas': [TransformedDateSchema] as const
});

const _dateResult = jtDate.instantiate('https://rt.test/Date', { 'epoch': 1_704_067_200_000 });

type DateRoundTrip = AssertEqualType<typeof _dateResult, TransformedExpected>;
assert<DateRoundTrip>();

void _dateResult;

// ---------------------------------------------------------------------------
// Suppress unused warnings
// ---------------------------------------------------------------------------

void [
  CircleSchema,
  RectSchema,
  ShapeSchema,
  TransformedDateSchema
];

void describe('round-trip type identity (compile-time only)', () => {
  void it('compiles', () => {
    void 0;
  });
});
