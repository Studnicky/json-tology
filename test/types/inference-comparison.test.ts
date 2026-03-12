/**
 * Type inference comparison: json-tology InferSchema vs json-schema-to-ts FromSchema.
 *
 * This file does NOT run — it only needs to compile.
 * Each test assigns a json-tology inferred type to a json-schema-to-ts inferred type
 * and vice versa. If they are structurally equivalent, both directions compile.
 */

import type { FromSchema } from 'json-schema-to-ts';
import type { InferSchema } from '../../src/types/infer.js';

// ---------------------------------------------------------------------------
// Helper: bidirectional assignability check
// ---------------------------------------------------------------------------
type AssertEqual<A, B> =
  [A] extends [B] ? [B] extends [A] ? true : false : false;

// compile-time assertion — produces an error if T is not true
function assert<T extends true>(): void {}

// ---------------------------------------------------------------------------
// 1. Primitive string
// ---------------------------------------------------------------------------
const StringSchema = { type: 'string' } as const;
type OursString = InferSchema<typeof StringSchema>;
type TheirsString = FromSchema<typeof StringSchema>;
assert<AssertEqual<OursString, TheirsString>>();

// ---------------------------------------------------------------------------
// 2. Primitive number
// ---------------------------------------------------------------------------
const NumberSchema = { type: 'number' } as const;
type OursNumber = InferSchema<typeof NumberSchema>;
type TheirsNumber = FromSchema<typeof NumberSchema>;
assert<AssertEqual<OursNumber, TheirsNumber>>();

// ---------------------------------------------------------------------------
// 3. Primitive integer (both should infer number)
// ---------------------------------------------------------------------------
const IntegerSchema = { type: 'integer' } as const;
type OursInteger = InferSchema<typeof IntegerSchema>;
type TheirsInteger = FromSchema<typeof IntegerSchema>;
assert<AssertEqual<OursInteger, TheirsInteger>>();

// ---------------------------------------------------------------------------
// 4. Primitive boolean
// ---------------------------------------------------------------------------
const BoolSchema = { type: 'boolean' } as const;
type OursBool = InferSchema<typeof BoolSchema>;
type TheirsBool = FromSchema<typeof BoolSchema>;
assert<AssertEqual<OursBool, TheirsBool>>();

// ---------------------------------------------------------------------------
// 5. Null
// ---------------------------------------------------------------------------
const NullSchema = { type: 'null' } as const;
type OursNull = InferSchema<typeof NullSchema>;
type TheirsNull = FromSchema<typeof NullSchema>;
assert<AssertEqual<OursNull, TheirsNull>>();

// ---------------------------------------------------------------------------
// 6. Const literal
// ---------------------------------------------------------------------------
const ConstSchema = { const: 'hello' } as const;
type OursConst = InferSchema<typeof ConstSchema>;
type TheirsConst = FromSchema<typeof ConstSchema>;
assert<AssertEqual<OursConst, TheirsConst>>();

// ---------------------------------------------------------------------------
// 7. Enum
// ---------------------------------------------------------------------------
const EnumSchema = { enum: ['a', 'b', 'c'] } as const;
type OursEnum = InferSchema<typeof EnumSchema>;
type TheirsEnum = FromSchema<typeof EnumSchema>;
assert<AssertEqual<OursEnum, TheirsEnum>>();

// ---------------------------------------------------------------------------
// 8. Simple array
// ---------------------------------------------------------------------------
const ArraySchema = { type: 'array', items: { type: 'string' } } as const;
type OursArray = InferSchema<typeof ArraySchema>;
type TheirsArray = FromSchema<typeof ArraySchema>;
// Both produce readonly arrays — verify element type matches
type _ArrayElementOurs = OursArray extends readonly (infer E)[] ? E : never;
type _ArrayElementTheirs = TheirsArray extends readonly (infer E)[] ? E : never;
assert<AssertEqual<_ArrayElementOurs, _ArrayElementTheirs>>();

// ---------------------------------------------------------------------------
// 9. Simple object with required
// ---------------------------------------------------------------------------
const ObjectSchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    age: { type: 'number' }
  },
  required: ['name']
} as const;
type OursObject = InferSchema<typeof ObjectSchema>;
type TheirsObject = FromSchema<typeof ObjectSchema>;
// Both should have { name: string; age?: number }
// Note: FromSchema may add [k: string]: unknown for open objects
// We check our type is assignable to theirs (our type is a subtype)
type _OursToTheirs = OursObject extends TheirsObject ? true : false;
assert<_OursToTheirs>();

// ---------------------------------------------------------------------------
// 10. Nullable type array
// ---------------------------------------------------------------------------
const NullableSchema = { type: ['string', 'null'] } as const;
type OursNullable = InferSchema<typeof NullableSchema>;
type TheirsNullable = FromSchema<typeof NullableSchema>;
assert<AssertEqual<OursNullable, TheirsNullable>>();

// ---------------------------------------------------------------------------
// 11. anyOf union
// ---------------------------------------------------------------------------
const AnyOfSchema = {
  anyOf: [
    { type: 'string' },
    { type: 'number' }
  ]
} as const;
type OursAnyOf = InferSchema<typeof AnyOfSchema>;
type TheirsAnyOf = FromSchema<typeof AnyOfSchema>;
assert<AssertEqual<OursAnyOf, TheirsAnyOf>>();

// ---------------------------------------------------------------------------
// 12. $ref / $defs
// ---------------------------------------------------------------------------
const RefSchema = {
  type: 'object',
  properties: {
    child: { $ref: '#/$defs/Child' }
  },
  required: ['child'],
  $defs: {
    Child: {
      type: 'object',
      properties: {
        name: { type: 'string' }
      },
      required: ['name']
    }
  }
} as const;
type OursRef = InferSchema<typeof RefSchema>;
type TheirsRef = FromSchema<typeof RefSchema>;
// Check our child.name is string
type _RefCheck = OursRef extends { child: { name: string } } ? true : false;
assert<_RefCheck>();

// ---------------------------------------------------------------------------
// 13. allOf intersection
// ---------------------------------------------------------------------------
const AllOfSchema = {
  allOf: [
    { type: 'object', properties: { a: { type: 'string' } }, required: ['a'] },
    { type: 'object', properties: { b: { type: 'number' } }, required: ['b'] }
  ]
} as const;
type OursAllOf = InferSchema<typeof AllOfSchema>;
// Should have both a: string and b: number
type _AllOfCheck = OursAllOf extends { a: string; b: number } ? true : false;
assert<_AllOfCheck>();

// ---------------------------------------------------------------------------
// 14. additionalProperties: false
// ---------------------------------------------------------------------------
const ClosedSchema = {
  type: 'object',
  properties: {
    x: { type: 'number' }
  },
  required: ['x'],
  additionalProperties: false
} as const;
type OursClosed = InferSchema<typeof ClosedSchema>;
type TheirsClosed = FromSchema<typeof ClosedSchema>;
assert<AssertEqual<OursClosed, TheirsClosed>>();

// Prevent unused variable warnings
void [
  StringSchema, NumberSchema, IntegerSchema, BoolSchema, NullSchema,
  ConstSchema, EnumSchema, ArraySchema, ObjectSchema, NullableSchema,
  AnyOfSchema, RefSchema, AllOfSchema, ClosedSchema
];
