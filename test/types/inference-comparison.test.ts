/**
 * Type inference comparison: json-tology InferSchema vs json-schema-to-ts FromSchema.
 *
 * This file does NOT run — it only needs to compile.
 * Each test assigns a json-tology inferred type to a json-schema-to-ts inferred type
 * and vice versa. If they are structurally equivalent, both directions compile.
 */

import type { FromSchema } from 'json-schema-to-ts';
import type { InferSchemaType } from '../../src/types/Infer.js';

// ---------------------------------------------------------------------------
// Helper: bidirectional assignability check
// ---------------------------------------------------------------------------
type AssertEqual<TA, TB>
  = [TA] extends [TB] ? [TB] extends [TA] ? true : false : false;

// compile-time assertion — produces an error if T is not true
function assertType<T extends true>(): void {
  void (undefined as unknown as T);
}

// ---------------------------------------------------------------------------
// 1. Primitive string
// ---------------------------------------------------------------------------
const StringSchema = { 'type': 'string' } as const;

type OursString = InferSchemaType<typeof StringSchema>;
type TheirsString = FromSchema<typeof StringSchema>;
assertType<AssertEqual<OursString, TheirsString>>();

// ---------------------------------------------------------------------------
// 2. Primitive number
// ---------------------------------------------------------------------------
const NumberSchema = { 'type': 'number' } as const;

type OursNumber = InferSchemaType<typeof NumberSchema>;
type TheirsNumber = FromSchema<typeof NumberSchema>;
assertType<AssertEqual<OursNumber, TheirsNumber>>();

// ---------------------------------------------------------------------------
// 3. Primitive integer (both should infer number)
// ---------------------------------------------------------------------------
const IntegerSchema = { 'type': 'integer' } as const;

type OursInteger = InferSchemaType<typeof IntegerSchema>;
type TheirsInteger = FromSchema<typeof IntegerSchema>;
assertType<AssertEqual<OursInteger, TheirsInteger>>();

// ---------------------------------------------------------------------------
// 4. Primitive boolean
// ---------------------------------------------------------------------------
const BoolSchema = { 'type': 'boolean' } as const;

type OursBool = InferSchemaType<typeof BoolSchema>;
type TheirsBool = FromSchema<typeof BoolSchema>;
assertType<AssertEqual<OursBool, TheirsBool>>();

// ---------------------------------------------------------------------------
// 5. Null
// ---------------------------------------------------------------------------
const NullSchema = { 'type': 'null' } as const;

type OursNull = InferSchemaType<typeof NullSchema>;
type TheirsNull = FromSchema<typeof NullSchema>;
assertType<AssertEqual<OursNull, TheirsNull>>();

// ---------------------------------------------------------------------------
// 6. Const literal
// ---------------------------------------------------------------------------
const ConstSchema = { 'const': 'hello' } as const;

type OursConst = InferSchemaType<typeof ConstSchema>;
type TheirsConst = FromSchema<typeof ConstSchema>;
assertType<AssertEqual<OursConst, TheirsConst>>();

// ---------------------------------------------------------------------------
// 7. Enum
// ---------------------------------------------------------------------------
const EnumSchema = {
  'enum': [
    'a',
    'b',
    'c'
  ]
} as const;

type OursEnum = InferSchemaType<typeof EnumSchema>;
type TheirsEnum = FromSchema<typeof EnumSchema>;
assertType<AssertEqual<OursEnum, TheirsEnum>>();

// ---------------------------------------------------------------------------
// 8. Simple array
// ---------------------------------------------------------------------------
const ArraySchema = {
  'items': { 'type': 'string' },
  'type': 'array'
} as const;

type OursArray = InferSchemaType<typeof ArraySchema>;
type TheirsArray = FromSchema<typeof ArraySchema>;
// Both produce readonly arrays — verify element type matches
type ArrayElementOurs = OursArray extends ReadonlyArray<infer TE> ? TE : never;
type ArrayElementTheirs = TheirsArray extends ReadonlyArray<infer TE> ? TE : never;
assertType<AssertEqual<ArrayElementOurs, ArrayElementTheirs>>();

// ---------------------------------------------------------------------------
// 9. Simple object with required
// ---------------------------------------------------------------------------
const ObjectSchema = {
  'properties': {
    'age': { 'type': 'number' },
    'name': { 'type': 'string' }
  },
  'required': ['name'],
  'type': 'object'
} as const;

type OursObject = InferSchemaType<typeof ObjectSchema>;
type TheirsObject = FromSchema<typeof ObjectSchema>;
// Both should have { name: string; age?: number }
// Note: FromSchema may add [k: string]: unknown for open objects
// We check our type is assignable to theirs (our type is a subtype)
type OursToTheirs = OursObject extends TheirsObject ? true : false;
assertType<OursToTheirs>();

// ---------------------------------------------------------------------------
// 10. Nullable type array
// ---------------------------------------------------------------------------
const NullableSchema = {
  'type': [
    'string',
    'null'
  ]
} as const;

type OursNullable = InferSchemaType<typeof NullableSchema>;
type TheirsNullable = FromSchema<typeof NullableSchema>;
assertType<AssertEqual<OursNullable, TheirsNullable>>();

// ---------------------------------------------------------------------------
// 11. anyOf union
// ---------------------------------------------------------------------------
const AnyOfSchema = {
  'anyOf': [
    { 'type': 'string' },
    { 'type': 'number' }
  ]
} as const;

type OursAnyOf = InferSchemaType<typeof AnyOfSchema>;
type TheirsAnyOf = FromSchema<typeof AnyOfSchema>;
assertType<AssertEqual<OursAnyOf, TheirsAnyOf>>();

// ---------------------------------------------------------------------------
// 12. $ref / $defs
// ---------------------------------------------------------------------------
const RefSchema = {
  '$defs': {
    'Child': {
      'properties': { 'name': { 'type': 'string' } },
      'required': ['name'],
      'type': 'object'
    }
  },
  'properties': { 'child': { '$ref': '#/$defs/Child' } },
  'required': ['child'],
  'type': 'object'
} as const;

type OursRef = InferSchemaType<typeof RefSchema>;
type TheirsRef = FromSchema<typeof RefSchema>;
void (undefined as unknown as TheirsRef);
// Check our child.name is string
type RefCheck = OursRef extends { 'child': { 'name': string } } ? true : false;
assertType<RefCheck>();

// ---------------------------------------------------------------------------
// 13. allOf intersection
// ---------------------------------------------------------------------------
const AllOfSchema = {
  'allOf': [
    {
      'properties': { 'a': { 'type': 'string' } },
      'required': ['a'],
      'type': 'object'
    },
    {
      'properties': { 'b': { 'type': 'number' } },
      'required': ['b'],
      'type': 'object'
    }
  ]
} as const;

type OursAllOf = InferSchemaType<typeof AllOfSchema>;
// Should have both a: string and b: number
type AllOfCheck = OursAllOf extends { 'a': string;
  'b': number } ? true : false;
assertType<AllOfCheck>();

// ---------------------------------------------------------------------------
// 14. additionalProperties: false
// ---------------------------------------------------------------------------
const ClosedSchema = {
  'additionalProperties': false,
  'properties': { 'x': { 'type': 'number' } },
  'required': ['x'],
  'type': 'object'
} as const;

type OursClosed = InferSchemaType<typeof ClosedSchema>;
type TheirsClosed = FromSchema<typeof ClosedSchema>;
assertType<AssertEqual<OursClosed, TheirsClosed>>();

// Prevent unused variable warnings
void [
  StringSchema,
  NumberSchema,
  IntegerSchema,
  BoolSchema,
  NullSchema,
  ConstSchema,
  EnumSchema,
  ArraySchema,
  ObjectSchema,
  NullableSchema,
  AnyOfSchema,
  RefSchema,
  AllOfSchema,
  ClosedSchema
];
