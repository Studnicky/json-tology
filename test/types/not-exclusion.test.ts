/**
 * Compile-time experiments: can TypeScript's type system express JSON Schema `not`?
 *
 * TL;DR of findings (inline below):
 * - Primitive const/enum exclusion: YES, via Exclude on unions
 * - Object property narrowing via `not`: PARTIAL, works when the negated
 *   property has a const/enum (produces Exclude<string, 'admin'>)
 * - Full structural `not` (arbitrary nested negation): NO, TypeScript has
 *   no negation types. We can only narrow when the negated schema provides
 *   a finite set to exclude.
 * - oneOf branch exclusion: YES, Exclude naturally removes matching union members
 */

import type { InferSchemaType } from '../../src/types/schema.js';

// ============================================================================
// Utility: type-level equality check
// ============================================================================

type Expect<T extends true> = T;
type Equal<TA, TB>
  = (<TVal>() => TVal extends TA ? 1 : 2) extends (<TVal>() => TVal extends TB ? 1 : 2)
    ? true
    : false;

// ============================================================================
// 1. Primitive const exclusion — the easy case
// ============================================================================

// `not: { const: 'admin' }` on a string field means Exclude<string, 'admin'>.
// But Exclude<string, 'admin'> === string — TypeScript doesn't have negation
// types, so excluding a literal from a wide type is a no-op.

type Case1 = Exclude<string, 'admin'>;
// string, not "string minus admin"
type ConstExclusionCheck = Expect<Equal<Case1, string>>;

// This means: for WIDE types, `not` exclusion has no type-level effect.
// TypeScript cannot represent "all strings except 'admin'".

// ============================================================================
// 2. Enum/union exclusion — this DOES work
// ============================================================================

// If the base type is a union (from enum), Exclude removes matching members.
type Roles = 'admin' | 'editor' | 'viewer';
type NonAdminRoles = Exclude<Roles, 'admin'>;
type EnumExclusionCheck = Expect<Equal<NonAdminRoles, 'editor' | 'viewer'>>;

// This is the sweet spot: `not` with `const` against an `enum` base.

// ============================================================================
// 3. Object property narrowing — the hard question
// ============================================================================

// Given:
//   { type: 'object', properties: { role: { type: 'string' } },
//     not: { properties: { role: { const: 'admin' } }, required: ['role'] } }
//
// Desired: { role?: Exclude<string, 'admin'> }
// Actual:  { role?: string } (Exclude<string, 'admin'> collapses to string)

// So even if we build the machinery, the result is identical to no `not`.
// UNLESS the base property is an enum:

const _SchemaWithEnumAndNot = {
  'not': {
    'properties': { 'role': { 'const': 'admin' } },
    'required': ['role']
  },
  'properties': {
    'role': {
      'enum': [
        'admin',
        'editor',
        'viewer'
      ]
    }
  },
  'type': 'object'
} as const;

// Here's the type we WANT to produce:
interface DesiredResult { readonly 'role'?: 'editor' | 'viewer' }
void (undefined as unknown as DesiredResult);

// ============================================================================
// 4. InferNotType — experimental recursive narrowing
// ============================================================================

/**
 * Given a "not" sub-schema, infer the type it describes so we can Exclude it.
 *
 * Strategy: infer the `not` schema's type the same way we infer the base,
 * then use a property-wise Exclude to narrow the base object.
 */

// Step 1: Extract the "negative" property types from a `not` sub-schema
type NegatedPropertyTypes<TNotSchema, TRoot>
  = TNotSchema extends { readonly 'properties': infer TNP }
    ? { [K in keyof TNP]: InferSchemaType<TNP[K], TRoot> }
    : Record<string, never>;
void (undefined as unknown as NegatedPropertyTypes<unknown, unknown>);

// Step 2: For each property in the base, if the `not` schema constrains it,
// Exclude the negated type from the base type.
type ApplyPropertyNotType<TBaseProps, TNegatedProps> = {
  [K in keyof TBaseProps]:
  K extends keyof TNegatedProps
    ? Exclude<TBaseProps[K], TNegatedProps[K]>
    : TBaseProps[K];
};

// Proof of concept with concrete types:
interface BaseRoleProps { 'role': 'admin' | 'editor' | 'viewer' }
interface NegatedRoleProps { 'role': 'admin' }
type NarrowedRole = ApplyPropertyNotType<BaseRoleProps, NegatedRoleProps>;
type PropertyNarrowCheck = Expect<Equal<NarrowedRole, { 'role': 'editor' | 'viewer' }>>;
// YES — this works when the base is a union.

// ============================================================================
// 5. Full InferNotType integration sketch
// ============================================================================

/**
 * Apply `not` narrowing to an already-inferred object type.
 *
 * This only has a type-level effect when:
 * - The `not` schema specifies property-level `const` or `enum` constraints
 * - The base property type is a finite union (from `enum` or `oneOf` of consts)
 *
 * For wide types (string, number), the exclusion is a no-op at the type level
 * even though it matters at runtime validation.
 */
type InferWithNotType<T, TRoot>
  = T extends { readonly 'not': infer TN }
    ? T extends { readonly 'properties': infer TP;
      readonly 'type': 'object'; }
      ? TN extends { readonly 'properties': infer TNP }
        ? SimplifyNotType<{
          readonly [K in keyof TP]:
          K extends keyof TNP
            ? Exclude<InferSchemaType<TP[K], TRoot>, InferSchemaType<TNP[K], TRoot>>
            : InferSchemaType<TP[K], TRoot>;
        }>
        // `not` without properties (e.g., `not: { type: 'null' }`) — no property narrowing
        : InferSchemaType<Omit<T, 'not'>, TRoot>
      // Non-object `not` — only useful for primitive exclusion
      : Exclude<InferSchemaType<Omit<T, 'not'>, TRoot>, InferSchemaType<TN, TRoot>>
    : InferSchemaType<T, TRoot>;

type SimplifyNotType<T> = { [K in keyof T]: T[K] } & {};

// Test: enum base + const negation on object property
type TestEnumNot = InferWithNotType<typeof _SchemaWithEnumAndNot, typeof _SchemaWithEnumAndNot>;
type EnumNotCheck = Expect<Equal<TestEnumNot, { readonly 'role': 'editor' | 'viewer' }>>;

// Test: wide string base + const negation — no-op (expected)
const _SchemaWithStringAndNot = {
  'not': {
    'properties': { 'role': { 'const': 'admin' } },
    'required': ['role']
  },
  'properties': { 'role': { 'type': 'string' } },
  'type': 'object'
} as const;

type TestStringNot = InferWithNotType<typeof _SchemaWithStringAndNot, typeof _SchemaWithStringAndNot>;
type StringNotCheck = Expect<Equal<TestStringNot, { readonly 'role': string }>>;
// Collapse: Exclude<string, 'admin'> = string. Correct — no narrowing possible.

// ============================================================================
// 6. Primitive `not` — excluding types from unions
// ============================================================================

// `not: { type: 'null' }` on a nullable type
type NullableString = null | string;
type NonNullString = Exclude<NullableString, null>;
type NullExclusionCheck = Expect<Equal<NonNullString, string>>;

// This works naturally — `not: { type: 'null' }` removes null from type unions.
// A type-array schema like `type: ['string', 'null']` with `not: { type: 'null' }`
// would correctly narrow to `string`.

const _NullableWithNot = {
  'not': { 'type': 'null' },
  'type': [
    'string',
    'null'
  ]
} as const;

// With InferWithNotType, this would produce: Exclude<string | null, null> = string

// ============================================================================
// 7. oneOf branch exclusion
// ============================================================================

// `not` to exclude specific oneOf branches works IF branches are distinguishable.

interface Circle { readonly 'kind': 'circle';
  readonly 'radius': number }
interface Square { readonly 'kind': 'square';
  readonly 'side': number }
interface Triangle { readonly 'base': number;
  readonly 'kind': 'triangle'; }
type Shape = Circle | Square | Triangle;

// "not a circle" — Exclude works on discriminated unions
type NonCircle = Exclude<Shape, { 'kind': 'circle' }>;
type OneOfExclusionCheck = Expect<Equal<NonCircle, Square | Triangle>>;

// This works because Exclude removes union members that extend the exclusion type.
// For oneOf schemas where each branch has a discriminant const, `not` can remove branches.

// ============================================================================
// 8. Deep/nested `not` — recursion limits
// ============================================================================

// `not: { not: { const: 'admin' } }` === `const: 'admin'` (double negation)
// TypeScript CAN represent this, but the recursive inference gets complex.

// `not: { anyOf: [...] }` === `allOf: [not(branch1), not(branch2), ...]`
// De Morgan's law at the type level — theoretically possible but combinatorially
// explosive for the type checker.

// Practical limit: one level of property-wise `not` with const/enum exclusion
// is the useful sweet spot. Deeper nesting hits diminishing returns against
// TypeScript's recursion depth and type instantiation limits.

// ============================================================================
// 9. Summary: what InferSchemaType could gain
// ============================================================================

// Integration point in the master dispatcher (src/types/infer.ts):
//
//   T extends { readonly not: infer N }
//     ? ApplyNot<InferSchemaType<Omit<T, 'not'>, Root, Refs>, N, Root, Refs>
//     : ...existing dispatch...
//
// Where ApplyNot does property-wise Exclude for objects, direct Exclude for
// primitives/unions. The key constraint: Exclude only narrows finite unions.
//
// Worth implementing for:
//   - enum + not const  ->  removes union members
//   - type array + not type  ->  removes null etc.
//   - oneOf + not (discriminated branch)  ->  removes branches
//
// NOT worth implementing for:
//   - string + not const  ->  still string (no-op)
//   - deeply nested not/anyOf/allOf  ->  explosion risk
//   - not with arbitrary structural schemas  ->  no negation types in TS

// Suppress unused type warnings
void [
  undefined as unknown as ConstExclusionCheck,
  undefined as unknown as EnumExclusionCheck,
  undefined as unknown as PropertyNarrowCheck,
  undefined as unknown as EnumNotCheck,
  undefined as unknown as StringNotCheck,
  undefined as unknown as NullExclusionCheck,
  undefined as unknown as OneOfExclusionCheck
];
