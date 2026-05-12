/**
 * Compile-time type assertions for JsonTology generic type accumulation.
 *
 * This file validates that:
 * 1. JsonTology.create() infers types from constructor schemas
 * 2. .register() accumulates types via chaining
 * 3. coerce(), is(), validate() constrain schemaId to registered keys
 * 4. coerce() returns the correct inferred type
 * 5. Incorrect schema IDs and type mismatches are caught at compile time
 *
 * Compile with: tsc --noEmit --project tsconfig.test-types.json
 */

import { JsonTology } from '../../src/JsonTology.js';
import type { DuplicateSchemaIdInterface } from '../../src/types/TypeErrors.js';
import type { UniqueSchemaIdsType } from '../../src/types/Registry.js';

// ---------------------------------------------------------------------------
// Test schemas
// ---------------------------------------------------------------------------

const UserSchema = {
  '$id': 'https://example.io/User',
  'properties': {
    'age': { 'type': 'number' },
    'name': { 'type': 'string' }
  },
  'required': ['name'],
  'type': 'object'
} as const;

const OrderSchema = {
  '$id': 'https://example.io/Order',
  'properties': {
    'orderId': { 'type': 'string' },
    'total': { 'type': 'number' }
  },
  'required': [
    'orderId',
    'total'
  ],
  'type': 'object'
} as const;

const TagSchema = {
  '$id': 'https://example.io/Tag',
  'properties': { 'label': { 'type': 'string' } },
  'required': ['label'],
  'type': 'object'
} as const;

// ---------------------------------------------------------------------------
// 1. JsonTology.create() — constructor-time type inference
// ---------------------------------------------------------------------------

const jt = JsonTology.create({
  'baseIRI': 'https://example.io',
  'schemas': [
    UserSchema,
    OrderSchema
  ] as const
});

// coerce() returns inferred type
const user = jt.instantiate('https://example.io/User', { 'name': 'Ada' });
const _userName: string = user.name;
const _userAge: number | undefined = user.age;

const order = jt.instantiate('https://example.io/Order', {
  'orderId': 'o-1',
  'total': 42
});
const _orderId: string = order.orderId;
const _orderTotal: number = order.total;

// @ts-expect-error — accessing property that doesn't exist on User
const _bad1: boolean = user.name;

// is() narrows type
if (jt.is('https://example.io/User', {})) {
  // type narrowed
}

// validate() constrains to registered IDs
jt.validate('https://example.io/User', {});

// validate() constrains to registered IDs
jt.validate('https://example.io/Order', {});

// Runtime-unsafe type assertions — guarded to prevent execution
if (false as boolean) {
  // @ts-expect-error — schema ID not registered
  jt.instantiate('https://example.io/NotRegistered', {});
  // @ts-expect-error — schema ID not registered
  jt.is('https://example.io/NotRegistered', {});
  // @ts-expect-error — schema ID not registered
  jt.validate('https://example.io/NotRegistered', {});
  // @ts-expect-error — schema ID not registered
  jt.validate('https://example.io/NotRegistered', {});
}

// ---------------------------------------------------------------------------
// 2. .register() — chained type accumulation
// ---------------------------------------------------------------------------

const jt2 = JsonTology.create({
  'baseIRI': 'https://example.io',
  'schemas': [UserSchema] as const
}).register(OrderSchema);

// Both schemas accessible
const _u2 = jt2.instantiate('https://example.io/User', { 'name': 'Ada' });
const _o2 = jt2.instantiate('https://example.io/Order', {
  'orderId': 'o-1',
  'total': 42
});

if (false as boolean) {
  // @ts-expect-error — Tag not registered yet
  jt2.instantiate('https://example.io/Tag', {});
}

// Chain another register
const jt3 = jt2.register(TagSchema);
const tag = jt3.instantiate('https://example.io/Tag', { 'label': 'foo' });
const _tagLabel: string = tag.label;

// All three work on jt3
jt3.instantiate('https://example.io/User', { 'name': 'Ada' });
jt3.instantiate('https://example.io/Order', {
  'orderId': 'o-1',
  'total': 42
});
jt3.instantiate('https://example.io/Tag', { 'label': 'bar' });

// ---------------------------------------------------------------------------
// 3. Empty registry — nothing should be parseable
// ---------------------------------------------------------------------------

const empty = JsonTology.create({
  'baseIRI': 'https://example.io',
  'schemas': [] as const
});

if (false as boolean) {
  // @ts-expect-error — no schemas registered
  empty.instantiate('https://example.io/User', {});
}

// ---------------------------------------------------------------------------
// 4. Schema ID union type is accumulative
// ---------------------------------------------------------------------------

// Verified above: jt.instantiate('https://example.io/User', {}) compiles,
// jt.instantiate('https://example.io/NotRegistered', {}) fails.
// Direct string calls (not Parameters extraction) are the reliable way
// to test key accumulation with overloaded methods.

// ---------------------------------------------------------------------------
// 5. Type-safe parse output matches schema structure
// ---------------------------------------------------------------------------

// Verify parse output types flow correctly through the generic
const parsedUser = jt.instantiate('https://example.io/User', { 'name': 'Ada' });
const _nameCheck: string = parsedUser.name;
const _ageCheck: number | undefined = parsedUser.age;

const parsedOrder = jt.instantiate('https://example.io/Order', {
  'orderId': 'o-1',
  'total': 42
});
const _orderIdCheck: string = parsedOrder.orderId;
const _totalCheck: number = parsedOrder.total;

// ---------------------------------------------------------------------------
// 6. subschemaAt constrains to registered IDs
// ---------------------------------------------------------------------------

jt.subschemaAt('https://example.io/User', '/properties/name');

if (false as boolean) {
  // @ts-expect-error — unregistered schema
  jt.subschemaAt('https://example.io/NotRegistered', '/properties/name');
}

// ---------------------------------------------------------------------------
// Suppress unused variable warnings
// ---------------------------------------------------------------------------

void [
  _userName,
  _userAge,
  _orderId,
  _orderTotal,
  _bad1
];
void [
  _u2,
  _o2,
  _tagLabel
];
void [
  _nameCheck,
  _ageCheck,
  _orderIdCheck,
  _totalCheck
];

// ---------------------------------------------------------------------------
// 7. Finding 12 — duplicate `$id` in schemas tuple is a compile error
// ---------------------------------------------------------------------------

const DuplicateA = {
  '$id': 'https://example.io/Duplicate',
  'properties': { 'a': { 'type': 'string' } },
  'type': 'object'
} as const;

const DuplicateB = {
  '$id': 'https://example.io/Duplicate',
  'properties': { 'b': { 'type': 'number' } },
  'type': 'object'
} as const;

if (false as boolean) {
  JsonTology.create({
    'baseIRI': 'https://example.io',
    'schemas': [
      // @ts-expect-error — two schemas share '$id': 'https://example.io/Duplicate'
      DuplicateA,
      // @ts-expect-error — two schemas share '$id': 'https://example.io/Duplicate'
      DuplicateB
    ] as const
  });

  JsonTology.create({
    'baseIRI': 'https://example.io',
    'schemas': [DuplicateA] as const
  // @ts-expect-error — duplicate also rejected on chained register()
  }).register([
    DuplicateA,
    DuplicateB
  ] as const);
}

// Positive: distinct $ids accept fine
const _distinct = JsonTology.create({
  'baseIRI': 'https://example.io',
  'schemas': [
    UserSchema,
    OrderSchema,
    TagSchema
  ] as const
});

void _distinct;

// ---------------------------------------------------------------------------
// 7b. DuplicateSchemaIdInterface brand identity assertion
//
// When two schemas in a tuple share the same $id, UniqueSchemaIdsType brands
// each offending slot with DuplicateSchemaIdInterface<TId>. Verify that:
//   1. The brand has the correct `kind` discriminant.
//   2. The brand carries the duplicated $id literal.
//   3. UniqueSchemaIdsType[0] (for a 2-dup tuple) extends the brand.
// ---------------------------------------------------------------------------

type AssertEqualType<TLeft, TRight>
  = [TLeft] extends [TRight] ? [TRight] extends [TLeft] ? true : false : false;

function assertType<T extends true>(): void {
  void 0 as unknown as T;
}

// Brand structural identity
assertType<AssertEqualType<DuplicateSchemaIdInterface<'x'>['kind'], 'DuplicateSchemaId'>>();

assertType<AssertEqualType<DuplicateSchemaIdInterface<'https://example.io/Dup'>['duplicateId'], 'https://example.io/Dup'>>();

// UniqueSchemaIdsType brands duplicate slots with DuplicateSchemaIdInterface
type DupTuple = readonly [typeof DuplicateA, typeof DuplicateB];
type BrandedDupTuple = UniqueSchemaIdsType<DupTuple>;

// Both slots [0] and [1] should carry DuplicateSchemaIdInterface<'https://example.io/Duplicate'>
assertType<BrandedDupTuple[0] extends DuplicateSchemaIdInterface<'https://example.io/Duplicate'> ? true : false>();

assertType<BrandedDupTuple[1] extends DuplicateSchemaIdInterface<'https://example.io/Duplicate'> ? true : false>();

// Negative: a non-duplicate tuple is NOT branded — pass-through to the original type
type NonDupTuple = readonly [typeof UserSchema, typeof OrderSchema];
type BrandedNonDup = UniqueSchemaIdsType<NonDupTuple>;

assertType<AssertEqualType<BrandedNonDup[0], typeof UserSchema>>();

// ---------------------------------------------------------------------------
// 8. Finding 13 — addComputed / addInvariant reject unregistered schema IDs
// ---------------------------------------------------------------------------

// Positive: registered schema accepted
jt.addComputed('https://example.io/User', 'name', (_) => {
  return 'computed';
});
jt.addInvariant('https://example.io/User', {
  'fn': (_) => {
    return null;
  },
  'name': 'check-name'
});

if (false as boolean) {
  // @ts-expect-error — schema not registered
  jt.addComputed('https://example.io/NotRegistered', 'name', (_) => {
    return 'x';
  });
  // @ts-expect-error — schema not registered
  jt.addInvariant('https://example.io/NotRegistered', {
    'fn': (_) => {
      return null;
    },
    'name': 'no'
  });
}

// ---------------------------------------------------------------------------
// 9. Finding 14 — findDuplicates() returns literal-typed equivalentTo
// ---------------------------------------------------------------------------

const _dups = jt.findDuplicates();

void _dups;
type DupEntry = typeof _dups[number];
type DupEquivalentTo = DupEntry['equivalentTo'];

// Positive: equivalentTo is the literal union of registered $ids
const _eq: DupEquivalentTo = 'https://example.io/User';
const _eq2: DupEquivalentTo = 'https://example.io/Order';

void [
  _eq,
  _eq2
];

if (false as boolean) {
  // @ts-expect-error — equivalentTo is not an arbitrary string
  const _badEq: DupEquivalentTo = 'https://example.io/NotRegistered';

  void _badEq;
}
