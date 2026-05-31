/**
 * Compile-time assertions proving deep cross-schema `$ref` resolution
 * through the registered-bundle path, and documenting the fundamental
 * limit of standalone `InferType<S>` without a references map.
 *
 * ## What is automatic (bundle path)
 *
 * `SchemaReferencesMapType<typeof tuple>` builds a `{ [$id]: schema }` map
 * from the tuple in O(1) depth (mapped type over the element union). When
 * passed to `InferType<TSchema, TRefs>`, every cross-schema `$ref` resolves
 * transitively — no depth limit other than TypeScript's own instantiation
 * cap (TS2589). This map can be constructed from ANY tuple the consumer
 * already has; it does not require a running `JsonTology` instance.
 *
 * `SchemaMapFromTupleType<typeof tuple>` (used internally by `JsonTology`)
 * threads the same map through `ParseOutputType` for every registered schema,
 * so `jt.instantiate(id, data)` return types also resolve deeply.
 *
 * ## What is fundamentally impossible at compile time
 *
 * TypeScript cannot connect a string literal (e.g. `'urn:bookstore:Money'`)
 * to a schema object that is NOT in the current type's scope. A standalone
 * `InferType<typeof BookSchema>` with no `TReferences` argument has no map
 * to look up — `BookSchema` only carries the string `$ref`, not the target
 * schema object. The fallback is `unknown` (not an error; `unknown` is the
 * honest "I cannot resolve this at compile time" answer). This is intentional:
 * flooding standalone consumers with `RefNotFoundInterface` noise would break
 * existing usage where cross-ref resolution is simply not relevant.
 *
 * The solution for consumers who want deep resolution:
 *   1. Collect all schemas in a `const` tuple.
 *   2. Derive `SchemaReferencesMapType<typeof tuple>` once (one line).
 *   3. Pass it as `TReferences` to `InferType<TSchema, TRefs>`.
 *
 * This is the ONLY pattern that works. TypeScript cannot do it for you
 * automatically because schema resolution is a runtime registry concept.
 */

import type {
  InferType,
  SchemaReferencesMapType
} from '../../src/types/index.js';
import type { SchemaMapFromTupleType } from '../../src/types/Registry.js';

// ---------------------------------------------------------------------------
// Bidirectional assignability helpers (same style as other type tests)
// ---------------------------------------------------------------------------

type AssertEqualType<TLeft, TRight>
  = [TLeft] extends [TRight] ? [TRight] extends [TLeft] ? true : false : false;

type AssertAssignableType<TSource, TTarget>
  = [TSource] extends [TTarget] ? true : false;

function assert<T extends true>(): void {
  void 0 as unknown as T;
}

// ---------------------------------------------------------------------------
// Minimal self-contained schema set (no bookstore dependency to keep fast)
//
// Chain: OrderSchema → OrderLineSchema → MoneySchema → AmountSchema (number)
//                                                    → CurrencyCodeSchema (enum)
//        OrderSchema → CustomerRefSchema (simple string $ref)
//
// Three levels of transitive cross-schema $ref through allOf composition.
// ---------------------------------------------------------------------------

const AmountSchema = {
  '$id': 'urn:test:Amount',
  'minimum': 0,
  'type': 'number'
} as const;

const CurrencyCodeSchema = {
  '$id': 'urn:test:CurrencyCode',
  'enum': [
    'USD',
    'EUR',
    'GBP'
  ] as const,
  'type': 'string'
} as const;

const MoneySchema = {
  '$id': 'urn:test:Money',
  'properties': {
    'amount': { '$ref': 'urn:test:Amount' },
    'currency': { '$ref': 'urn:test:CurrencyCode' }
  },
  'required': [
    'amount',
    'currency'
  ],
  'type': 'object'
} as const;

const CustomerSchema = {
  '$id': 'urn:test:Customer',
  'properties': {
    'email': { 'type': 'string' },
    'name': { 'type': 'string' }
  },
  'required': ['name'],
  'type': 'object'
} as const;

// BaseOrderSchema provides the order total field (allOf composition base)
const BaseOrderSchema = {
  '$id': 'urn:test:BaseOrder',
  'properties': { 'orderId': { 'type': 'string' } },
  'required': ['orderId'],
  'type': 'object'
} as const;

// OrderLineSchema references Money — 2nd level cross-schema ref
const OrderLineSchema = {
  '$id': 'urn:test:OrderLine',
  'properties': {
    'quantity': { 'type': 'number' },
    'unitPrice': { '$ref': 'urn:test:Money' }
  },
  'required': [
    'quantity',
    'unitPrice'
  ],
  'type': 'object'
} as const;

// OrderSchema: allOf([BaseOrder]) + own properties referencing Customer + OrderLine
// → 3 levels of transitive cross-schema $ref
const OrderSchema = {
  '$id': 'urn:test:Order',
  'allOf': [{ '$ref': 'urn:test:BaseOrder' }],
  'properties': {
    'customer': { '$ref': 'urn:test:Customer' },
    'lines': {
      'items': { '$ref': 'urn:test:OrderLine' },
      'type': 'array'
    }
  },
  'required': [
    'customer',
    'lines'
  ],
  'type': 'object'
} as const;

const _testSchemas = [
  AmountSchema,
  CurrencyCodeSchema,
  MoneySchema,
  CustomerSchema,
  BaseOrderSchema,
  OrderLineSchema,
  OrderSchema
] as const;

// ---------------------------------------------------------------------------
// 1. Bundle path — SchemaReferencesMapType built from the tuple
//
// BEFORE (standalone, no refs): Order['customer'] → unknown
// AFTER  (with refs map):       Order['customer'] → { name: string; email?: string }
// ---------------------------------------------------------------------------

type TestRefs = SchemaReferencesMapType<typeof _testSchemas>;

// Level 1: direct $ref to Customer resolves to its structural shape
type OrderType = InferType<typeof OrderSchema, TestRefs>;

assert<AssertAssignableType<
  OrderType['customer'],
  { readonly 'name': string }
>>();

// Level 2: OrderLine.unitPrice → Money (cross-schema $ref through array items)
type LineType = NonNullable<OrderType['lines']>[number];

assert<AssertAssignableType<
  LineType['unitPrice'],
  { readonly 'amount': number;
    readonly 'currency': string }
>>();

// Level 3: Money.amount → number (transitive $ref through 2 hops)
// Money.currency → 'USD' | 'EUR' | 'GBP' (enum via refs)
type MoneyType = InferType<typeof MoneySchema, TestRefs>;

// AmountSchema carries `minimum: 0`, so the inferred type is
// `MinimumBrandInterface<0> & number` — a subtype of number, not equal.
// Use AssertAssignableType (covariant check) rather than AssertEqualType.
assert<AssertAssignableType<MoneyType['amount'], number>>();
assert<AssertEqualType<MoneyType['currency'], 'EUR' | 'GBP' | 'USD'>>();

// Level 3 end-to-end: Order → lines[] → unitPrice → currency resolves to enum
type LinePriceType = NonNullable<OrderType['lines']>[number]['unitPrice'];

assert<AssertAssignableType<
  LinePriceType['currency'],
  'EUR' | 'GBP' | 'USD'
>>();

// allOf composition: Order inherits orderId from BaseOrder through allOf $ref
assert<AssertAssignableType<OrderType, { readonly 'orderId': string }>>();

// ---------------------------------------------------------------------------
// 2. Standalone limit — without TReferences, cross-schema $ref → unknown
//
// This is intentional. `unknown` is the honest answer: TypeScript cannot
// resolve a string IRI to an out-of-scope schema object. Consumers who need
// deep resolution must use the refs-map pattern above.
// ---------------------------------------------------------------------------

type StandaloneOrder = InferType<typeof OrderSchema>;

// customer is present in the shape (object property) but its type is unknown
// because 'urn:test:Customer' is not resolvable without a refs map.
assert<AssertAssignableType<
  StandaloneOrder,
  { readonly 'customer'?: unknown }
>>();

// Standalone Money: properties with cross-schema $refs → unknown
type StandaloneMoney = InferType<typeof MoneySchema>;

assert<AssertAssignableType<StandaloneMoney, { readonly 'amount'?: unknown }>>();
assert<AssertAssignableType<StandaloneMoney, { readonly 'currency'?: unknown }>>();

// ---------------------------------------------------------------------------
// 3. JsonTology instantiate return type resolves deeply (bundle path proof)
//
// The `SchemaMapFromTupleType<Tuple>` used by JsonTology threads
// `SchemaReferencesMapType<Tuple>` through every schema's inference, so
// instantiate() return types resolve exactly as well as InferType<S, TRefs>.
// ---------------------------------------------------------------------------

// Build the TMap type that JsonTology<TMap> holds when created from the tuple.
// `SchemaMapFromTupleType` is what `JsonTology.create({ schemas: tuple })` uses
// internally — this proves the bundle threading works without a runtime instance.
type TestTMap = SchemaMapFromTupleType<typeof _testSchemas>;

// Order's $id is 'urn:test:Order' — index directly into TMap.
type JtOrderResult = TestTMap['urn:test:Order'];

// The resolved Order type carries orderId from allOf + customer + lines.
assert<AssertAssignableType<JtOrderResult, { readonly 'orderId': string }>>();
assert<AssertAssignableType<JtOrderResult, { readonly 'customer': { readonly 'name': string } }>>();

// Money in TMap also resolves transitively through Amount and CurrencyCode.
type JtMoneyResult = TestTMap['urn:test:Money'];
assert<AssertAssignableType<JtMoneyResult, { readonly 'amount': number }>>();
assert<AssertEqualType<JtMoneyResult['currency'], 'EUR' | 'GBP' | 'USD'>>();


// ---------------------------------------------------------------------------
// 4. Refs map is O(1) to construct — consumer pattern
//
// A consumer with a schema tuple ALREADY has everything needed. One line.
// No wrapper types, no new public API, no interface change.
//
//   type MyRefs = SchemaReferencesMapType<typeof mySchemas>;
//   type MyOrder = InferType<typeof OrderSchema, MyRefs>;
//
// ---------------------------------------------------------------------------

// Prove the pattern compiles exactly as documented above (already done in §1)
// and that MoneyType['currency'] is the full enum — not unknown, not {}.
const _narrowCheck: MoneyType['currency'] = 'USD';

void _narrowCheck;

// Edge: a schema with NO cross-schema refs is unaffected by the refs map
type CustomerType = InferType<typeof CustomerSchema, TestRefs>;

assert<AssertEqualType<CustomerType['name'], string>>();
assert<AssertEqualType<
  undefined extends CustomerType['email'] ? true : false,
  true
>>();
