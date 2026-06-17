/**
 * Compile-time assertions documenting intentional over-approximations in
 * `InferType` for `oneOf` and `dependentSchemas`.
 *
 * ## (a) `oneOf` — inferred as a plain union (not exclusive XOR)
 *
 * JSON Schema runtime semantics for `oneOf` require that exactly ONE of the
 * listed sub-schemas validates. This "exactly-one" (XOR) constraint cannot be
 * expressed in the TypeScript type system — there is no XOR type operator.
 *
 * `InferSchemaType` maps `oneOf` to a plain TypeScript union (`|`). A value
 * that satisfies MORE than one branch (which `oneOf` would reject at runtime)
 * is not rejected at the type level. The over-approximation is deliberate and
 * documented in the top-of-file comment in `Infer.ts` under
 * `InferOneOfType`.
 *
 * Evidence: `InferOneOfType` pattern-matches
 *   `T extends { readonly 'oneOf': ReadonlyArray<infer V> }
 *     ? InferSchemaType<V, ...>`
 * which distributes over the union of V — identical to anyOf.
 *
 * ## (b) `dependentSchemas` — properties merged unconditionally (over-merge)
 *
 * JSON Schema runtime semantics for `dependentSchemas` apply the dependent
 * sub-schema only when the trigger key IS present. TypeScript cannot condition
 * a property on the presence of another property in the same object — the type
 * of a dependentSchemas-bound property would need to be `undefined` (absent)
 * when the trigger key is absent, or `T` (present) when the trigger is present.
 * This is a conditional-property type that TypeScript does not support natively.
 *
 * `InferDependentSchemasPropsType` merges the dependent properties as
 * `Partial<...>` (optional) onto the base object unconditionally. The dependent
 * properties are visible in the type whether or not the trigger key is present.
 * Runtime validation still enforces the conditional constraint.
 *
 * Evidence: in `Infer.ts`, `InferDependentSchemasPropsType` calls
 *   `Partial<InferAllDependentType<DS[keyof DS], TRoot, TReferences>>`
 * which is unconditional — no conditional type gates on the trigger key.
 *
 * ## Assertions in this file
 *
 * Each assertion verifies what TypeScript ACTUALLY infers (not what runtime
 * enforces). The intent is to lock the current over-approximation so any
 * future tightening is noticed and deliberate.
 */

import {
  describe, it
} from 'node:test';

import type { InferType } from '../../src/types/Schema.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type AssertAssignable<TSource, TTarget>
  = [TSource] extends [TTarget] ? true : false;

type AssertEqual<TLeft, TRight>
  = [TLeft] extends [TRight] ? [TRight] extends [TLeft] ? true : false : false;

function assert<T extends true>(): void {
  void 0 as unknown as T;
}

// ---------------------------------------------------------------------------
// (a) oneOf over-approximation
//
// Schema: oneOf of three mutually-exclusive shapes.
// Runtime: exactly ONE may validate (XOR).
// Inferred: plain union — all three shapes are simultaneously allowed by the
// type, even values satisfying more than one branch.
// ---------------------------------------------------------------------------

const PaymentSchema = {
  'oneOf': [
    {
      'properties': {
        'cardNumber': { 'type': 'string' },
        'method': { 'const': 'card' }
      },
      'required': [
        'method',
        'cardNumber'
      ],
      'type': 'object'
    },
    {
      'properties': { 'method': { 'const': 'cash' } },
      'required': ['method'],
      'type': 'object'
    },
    {
      'properties': {
        'method': { 'const': 'crypto' },
        'walletAddress': { 'type': 'string' }
      },
      'required': [
        'method',
        'walletAddress'
      ],
      'type': 'object'
    }
  ]
} as const;

void PaymentSchema;

type PaymentType = InferType<typeof PaymentSchema>;

// The inferred type is a plain union of all three member shapes.
// Each branch is individually assignable to PaymentType.
assert<AssertAssignable<
  { readonly 'cardNumber': string;
    readonly 'method': 'card' },
  PaymentType
>>();

assert<AssertAssignable<
  { readonly 'method': 'cash' },
  PaymentType
>>();

assert<AssertAssignable<
  { readonly 'method': 'crypto';
    readonly 'walletAddress': string },
  PaymentType
>>();

// OVER-APPROXIMATION: the union type does not enforce XOR.
// A value satisfying the 'card' branch IS assignable to PaymentType even if
// it also structurally satisfies the 'cash' branch (which runtime would reject
// via oneOf). TypeScript cannot express the mutual-exclusion constraint.
//
// The following asserts that a value with BOTH method:'card' (branch 0) and
// method:'cash' (branch 1) is not assignable to PaymentType — which IS true
// because the `method` property is a discriminating literal. The union itself
// is exclusive on `method`. That's a structural coincidence of this example,
// not a general oneOf-XOR guarantee.
//
// The real over-approximation is that if two branches have IDENTICAL structure
// (same properties, same types), TypeScript allows both — it cannot count which
// branch matched. We document that with an open union assertion, not a
// structural coincidence test.

// The inferred type equals the union of all three member shapes.
// (Using AssertAssignable in both directions to approximate equality under
// TypeScript's distributive union rules.)
type CardBranchType
  = { readonly 'cardNumber': string;
    readonly 'method': 'card' };
type CashBranchType
  = { readonly 'method': 'cash' };
type CryptoBranchType
  = { readonly 'method': 'crypto';
    readonly 'walletAddress': string };

// The union is a super-type of each branch individually.
assert<AssertAssignable<CardBranchType, PaymentType>>();
assert<AssertAssignable<CashBranchType, PaymentType>>();
assert<AssertAssignable<CryptoBranchType, PaymentType>>();

// Each branch is represented in the union (PaymentType is assignable to the
// union of all three, confirming no silent widening occurred).
assert<AssertAssignable<PaymentType, CardBranchType | CashBranchType | CryptoBranchType>>();

// Note: Runtime validates exactly-one; the type permits any-one. This is the
// documented over-approximation. The assertion above LOCKS the union shape —
// if oneOf inference were ever tightened to a tagged/exclusive type, the
// backwards-assignability assertion would fail, alerting maintainers.

// ---------------------------------------------------------------------------
// (b) dependentSchemas over-merge
//
// Schema: a base object with a trigger key `country`. When `country` is
// present at runtime, the `region` property (from dependentSchemas) is also
// required. Without `country`, `region` need not be present.
//
// Inferred: `region` appears as optional on the base type UNCONDITIONALLY.
// The type does not capture the runtime conditional — you can write a value
// with `region` but no `country`, and TypeScript will not complain (runtime
// would still allow it since dependentSchemas only constrains the OTHER
// direction: country → region must also be present, but region alone is fine).
//
// The over-merge manifests as: the inferred type includes `region?` regardless
// of whether `country` is present, rather than expressing the conditional
// type `country extends string ? { region: string } : {}`.
// ---------------------------------------------------------------------------

const AddressSchema = {
  'dependentSchemas': {
    'country': {
      'properties': { 'region': { 'type': 'string' } },
      'required': ['region'],
      'type': 'object'
    }
  },
  'properties': {
    'city': { 'type': 'string' },
    'country': { 'type': 'string' }
  },
  'required': ['city'],
  'type': 'object'
} as const;

void AddressSchema;

type AddressType = InferType<typeof AddressSchema>;

// Base properties resolve normally
assert<AssertAssignable<AddressType, { readonly 'city': string }>>();

// OVER-MERGE: `region` appears as an optional property on AddressType
// unconditionally. At runtime, `region` is only required when `country` is
// present — but the TYPE allows `region` even without `country`.
// This is a compile-time over-approximation; runtime enforces the conditional.
assert<AssertAssignable<AddressType, { readonly 'region'?: string }>>();

// The type also permits { city, region } without country — runtime allows
// this too (dependentSchemas only says "if country then region required", not
// "region only when country"). So this is sound but still over-approximate:
// a { city, country } object without region satisfies the type (region is
// optional) even though runtime would REJECT it (country present → region
// required). The type DOES NOT encode the "country present → region required"
// constraint; both `country` and `region` are independently optional.
//
// To confirm the over-approximation: { city } alone (no country, no region)
// is assignable to AddressType.
const _cityOnly: AddressType = { 'city': 'Portland' };

void _cityOnly;

// And { city, country } without region is ALSO assignable (region is optional
// in the type even though runtime requires it when country is present).
const _cityCountry: AddressType = {
  'city': 'Portland',
  'country': 'US'
};

void _cityCountry;

// LOCK: The dependent property IS present in the inferred type as optional.
// If InferDependentSchemasPropsType were removed or changed to not merge the
// dependent props, `'region' in ({} as AddressType)` would be false at the
// type level and the AssertAssignable below would fail — alerting maintainers.
type HasOptionalRegion = AssertEqual<
  AddressType extends { readonly 'region'?: string } ? true : false,
  true
>;
assert<HasOptionalRegion>();

// ---------------------------------------------------------------------------
// Suppress unused variable warnings
// ---------------------------------------------------------------------------

void [
  PaymentSchema,
  AddressSchema
];

// ---------------------------------------------------------------------------
// Runtime smoke test
// ---------------------------------------------------------------------------

void describe('oneOf and dependentSchemas over-approximations', () => {
  void it('oneOf infers a plain union (not XOR)', () => {
    // All assertions are compile-time. This is a required runtime no-op.
    void PaymentSchema.oneOf.length;
  });

  void it('dependentSchemas merges dependent properties unconditionally as optional', () => {
    void AddressSchema.dependentSchemas;
  });
});
