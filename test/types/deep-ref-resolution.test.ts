/**
 * Compile-time assertions for cross-schema `$ref` resolution. `$ref`
 * resolution reads the reference graph reachable at the type level, through
 * three paths, and fails uniformly when the graph does not reach the target.
 *
 * ## Graph-native paths (no references argument)
 *
 * A `$ref` whose IRI matches a resource embedded under the schema's own
 * `$defs` (a self-contained / bundled compound document) resolves against that
 * embedded graph with no references map. A `$ref` equal to the root schema's
 * own `$id` resolves to the root (self-reference). Both work standalone.
 *
 * ## Registry-bound path (references threaded automatically)
 *
 * `SchemaReferencesMapType<typeof tuple>` builds a `{ [$id]: schema }` map
 * from a tuple in O(1) depth (a mapped type over the element union). Passed as
 * `TReferences` to `InferType<TSchema, TRefs>`, every cross-schema `$ref`
 * resolves transitively, bounded only by TypeScript's instantiation cap
 * (TS2589). `SchemaMapFromTupleType<typeof tuple>` (used internally by
 * `JsonTology.create({ schemas })`) threads the same map through
 * `ParseOutputType` for every registered schema, so `jt.instantiate(id, data)`
 * return types resolve deeply without the consumer constructing anything.
 *
 * ## Unreachable refs fail uniformly
 *
 * A `$ref` the reference graph does not reach resolves to
 * `RefNotFoundInterface<TRef>` (or `AnchorNotFoundInterface` for a fragment
 * whose anchor is missing on a reachable base) — the same brand whether or not
 * a references map is present. Resolution never degrades to a silent `unknown`:
 * an unresolved cross-schema `$ref` is a compile-time error brand, surfaced in
 * editor diagnostics. The structural limit is narrow and explicit — a bare IRI
 * string can only resolve when its target is reachable as one of the three
 * paths above; when it is not, the brand says so rather than widening to
 * `unknown`.
 */

import type {
  InferType,
  SchemaReferencesMapType
} from '../../src/types/index.js';
import type { SchemaMapFromTupleType } from '../../src/types/Registry.js';
import type { RefNotFoundInterface } from '../../src/types/TypeErrors.js';

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
// 2. Unreachable refs fail uniformly — without a references map and without
// embedding, a cross-schema $ref resolves to RefNotFoundInterface, NOT a
// silent unknown. The brand surfaces the unresolved IRI at compile time.
// ---------------------------------------------------------------------------

type StandaloneOrder = InferType<typeof OrderSchema>;

// 'urn:test:Customer' is neither embedded in OrderSchema's $defs nor threaded
// via a references map → the brand names the unresolved IRI.
assert<AssertAssignableType<
  StandaloneOrder['customer'],
  RefNotFoundInterface<'urn:test:Customer'>
>>();

// Standalone Money: each cross-schema $ref is unreachable → its own brand.
type StandaloneMoney = InferType<typeof MoneySchema>;

assert<AssertAssignableType<
  StandaloneMoney['amount'],
  RefNotFoundInterface<'urn:test:Amount'>
>>();
assert<AssertAssignableType<
  StandaloneMoney['currency'],
  RefNotFoundInterface<'urn:test:CurrencyCode'>
>>();

// ---------------------------------------------------------------------------
// 2b. Graph-native embedded resolution — a self-contained (bundled) schema
// carries its referenced resources under `$defs`, keyed by `$id`. A $ref to an
// embedded `$id` resolves against the document's own graph with NO references
// map and NO registry instance.
// ---------------------------------------------------------------------------

const BundledOrderSchema = {
  '$defs': {
    'CurrencyCode': {
      '$id': 'urn:test:CurrencyCode',
      'enum': [
        'USD',
        'EUR',
        'GBP'
      ] as const,
      'type': 'string'
    },
    'Customer': {
      '$id': 'urn:test:Customer',
      'properties': {
        'email': { 'type': 'string' },
        'name': { 'type': 'string' }
      },
      'required': ['name'],
      'type': 'object'
    },
    'Money': {
      '$id': 'urn:test:Money',
      'properties': {
        // sibling embedded resource — resolved against the original root's $defs
        'amount': { 'type': 'number' },
        'currency': { '$ref': 'urn:test:CurrencyCode' }
      },
      'required': [
        'amount',
        'currency'
      ],
      'type': 'object'
    }
  },
  '$id': 'urn:test:BundledOrder',
  'properties': {
    'customer': { '$ref': 'urn:test:Customer' },
    'price': { '$ref': 'urn:test:Money' }
  },
  'required': [
    'customer',
    'price'
  ],
  'type': 'object'
} as const;

void BundledOrderSchema;

// Standalone inference (no references map) resolves the embedded $refs.
type BundledOrderType = InferType<typeof BundledOrderSchema>;

assert<AssertAssignableType<
  BundledOrderType['customer'],
  { readonly 'name': string }
>>();

// Sibling resolution: price → Money, and Money.currency → CurrencyCode, both
// embedded — proves the embedded schema is inferred against the original root
// so sibling resources stay reachable.
assert<AssertAssignableType<
  BundledOrderType['price'],
  { readonly 'amount': number }
>>();
assert<AssertEqualType<
  BundledOrderType['price']['currency'],
  'EUR' | 'GBP' | 'USD'
>>();

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
