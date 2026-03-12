/**
 * Compile-time type assertions for InferSchema.
 *
 * This file does not need runtime assertions — it validates correct type
 * inference by compiling successfully (and failing on @ts-expect-error lines).
 */

import type { InferType, InferSchemaType } from '../../src/types/schema.js';
import type { ParseOutputType } from '../../src/types/transform.js';

// ---------------------------------------------------------------------------
// Test schemas
// ---------------------------------------------------------------------------

const StringSchema = { type: 'string' } as const;
const NumberSchema = { type: 'number' } as const;
const IntegerSchema = { type: 'integer' } as const;
const BooleanSchema = { type: 'boolean' } as const;
const NullSchema = { type: 'null' } as const;

const ConstSchema = { const: 'circle' } as const;
const EnumSchema = { enum: ['asc', 'desc'] } as const;

const StringArraySchema = { type: 'array', items: { type: 'string' } } as const;
const PlainArraySchema = { type: 'array' } as const;

const UserSchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    email: { type: 'string' },
    age: { type: 'number' },
  },
  required: ['name', 'email'],
} as const;

const NullableSchema = { type: ['string', 'null'] } as const;

const AllOfSchema = {
  allOf: [
    { type: 'object', properties: { a: { type: 'string' } }, required: ['a'] },
    { type: 'object', properties: { b: { type: 'number' } }, required: ['b'] },
  ],
} as const;

const AnyOfSchema = {
  anyOf: [
    { type: 'string' },
    { type: 'number' },
  ],
} as const;

const OneOfSchema = {
  oneOf: [
    { type: 'string' },
    { type: 'number' },
  ],
} as const;

const RefSchema = {
  type: 'object',
  properties: {
    child: { $ref: '#/$defs/Child' },
  },
  required: ['child'],
  $defs: {
    Child: {
      type: 'object',
      properties: { name: { type: 'string' } },
      required: ['name'],
    },
  },
} as const;

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

const _s: InferType<typeof StringSchema> = 'hello';
const _n: InferType<typeof NumberSchema> = 42;
const _i: InferType<typeof IntegerSchema> = 7;
const _b: InferType<typeof BooleanSchema> = true;
const _nl: InferType<typeof NullSchema> = null;

// @ts-expect-error — number is not string
const _bad1: InferType<typeof StringSchema> = 42;
// @ts-expect-error — string is not number
const _bad2: InferType<typeof NumberSchema> = 'hello';

// ---------------------------------------------------------------------------
// Const / Enum
// ---------------------------------------------------------------------------

const _c: InferType<typeof ConstSchema> = 'circle';
// @ts-expect-error — 'square' is not 'circle'
const _bad3: InferType<typeof ConstSchema> = 'square';

const _e: InferType<typeof EnumSchema> = 'asc';
const _e2: InferType<typeof EnumSchema> = 'desc';
// @ts-expect-error — 'random' is not in enum
const _bad4: InferType<typeof EnumSchema> = 'random';

// ---------------------------------------------------------------------------
// Arrays
// ---------------------------------------------------------------------------

const _arr: InferType<typeof StringArraySchema> = ['a', 'b'];
// @ts-expect-error — number[] not assignable to string[]
const _bad5: InferType<typeof StringArraySchema> = [1, 2];

// ---------------------------------------------------------------------------
// Objects (required/optional split)
// ---------------------------------------------------------------------------

const _u: InferType<typeof UserSchema> = { name: 'Alice', email: 'a@b.c' };
const _u2: InferType<typeof UserSchema> = { name: 'Alice', email: 'a@b.c', age: 30 };
// @ts-expect-error — missing required 'email'
const _bad6: InferType<typeof UserSchema> = { name: 'Alice' };

// ---------------------------------------------------------------------------
// Nullable
// ---------------------------------------------------------------------------

const _nullable1: InferType<typeof NullableSchema> = 'hello';
const _nullable2: InferType<typeof NullableSchema> = null;
// @ts-expect-error — number not assignable to string | null
const _bad7: InferType<typeof NullableSchema> = 42;

// ---------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------

const _anyOf: InferType<typeof AnyOfSchema> = 'hello';
const _anyOf2: InferType<typeof AnyOfSchema> = 42;

const _oneOf: InferType<typeof OneOfSchema> = 'hello';
const _oneOf2: InferType<typeof OneOfSchema> = 42;

// ---------------------------------------------------------------------------
// $ref / $defs
// ---------------------------------------------------------------------------

const _ref: InferType<typeof RefSchema> = { child: { name: 'Bob' } };
// @ts-expect-error — child.name is required
const _bad8: InferType<typeof RefSchema> = { child: {} };

// ---------------------------------------------------------------------------
// Suppress unused variable warnings
// ---------------------------------------------------------------------------

void _s, _n, _i, _b, _nl, _bad1, _bad2, _bad3, _bad4, _bad5, _bad6, _bad7, _bad8;
void _c, _e, _e2, _arr, _u, _u2, _nullable1, _nullable2, _anyOf, _anyOf2, _oneOf, _oneOf2, _ref;
