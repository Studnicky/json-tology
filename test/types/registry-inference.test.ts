/**
 * Compile-time type assertions for JsonTology generic type accumulation.
 *
 * This file validates that:
 * 1. JsonTology.create() infers types from constructor schemas
 * 2. .register() accumulates types via chaining
 * 3. parse(), is(), errors(), validate() constrain schemaId to registered keys
 * 4. parse() returns the correct inferred type
 * 5. Incorrect schema IDs and type mismatches are caught at compile time
 *
 * Compile with: tsc --noEmit --project tsconfig.test-types.json
 */

import { JsonTology } from '../../src/JsonTology.js';

// ---------------------------------------------------------------------------
// Test schemas
// ---------------------------------------------------------------------------

const UserSchema = {
  '$id': 'https://example.io/User',
  'type': 'object',
  'properties': {
    'name': { 'type': 'string' },
    'age': { 'type': 'number' },
  },
  'required': ['name'],
} as const;

const OrderSchema = {
  '$id': 'https://example.io/Order',
  'type': 'object',
  'properties': {
    'orderId': { 'type': 'string' },
    'total': { 'type': 'number' },
  },
  'required': ['orderId', 'total'],
} as const;

const TagSchema = {
  '$id': 'https://example.io/Tag',
  'type': 'object',
  'properties': {
    'label': { 'type': 'string' },
  },
  'required': ['label'],
} as const;

// ---------------------------------------------------------------------------
// 1. JsonTology.create() — constructor-time type inference
// ---------------------------------------------------------------------------

const jt = JsonTology.create({
  'baseIRI': 'https://example.io',
  'schemas': [UserSchema, OrderSchema] as const,
});

// parse() returns inferred type
const user = jt.parse('https://example.io/User', {});
const _userName: string = user.name;
const _userAge: number | undefined = user.age;

const order = jt.parse('https://example.io/Order', {});
const _orderId: string = order.orderId;
const _orderTotal: number = order.total;

// @ts-expect-error — schema ID not registered
jt.parse('https://example.io/NotRegistered', {});

// @ts-expect-error — accessing property that doesn't exist on User
const _bad1: boolean = user.name;

// is() narrows type
if (jt.is('https://example.io/User', {})) {
  // type narrowed
}

// @ts-expect-error — schema ID not registered
jt.is('https://example.io/NotRegistered', {});

// validate() constrains to registered IDs
jt.validate('https://example.io/User', {});

// @ts-expect-error — schema ID not registered
jt.validate('https://example.io/NotRegistered', {});

// errors() constrains to registered IDs
jt.errors('https://example.io/Order', {});

// @ts-expect-error — schema ID not registered
jt.errors('https://example.io/NotRegistered', {});

// ---------------------------------------------------------------------------
// 2. .register() — chained type accumulation
// ---------------------------------------------------------------------------

const jt2 = JsonTology.create({
  'baseIRI': 'https://example.io',
  'schemas': [UserSchema] as const,
}).register(OrderSchema);

// Both schemas accessible
const _u2 = jt2.parse('https://example.io/User', {});
const _o2 = jt2.parse('https://example.io/Order', {});

// @ts-expect-error — Tag not registered yet
jt2.parse('https://example.io/Tag', {});

// Chain another register
const jt3 = jt2.register(TagSchema);
const tag = jt3.parse('https://example.io/Tag', {});
const _tagLabel: string = tag.label;

// All three work on jt3
jt3.parse('https://example.io/User', {});
jt3.parse('https://example.io/Order', {});
jt3.parse('https://example.io/Tag', {});

// ---------------------------------------------------------------------------
// 3. Empty registry — nothing should be parseable
// ---------------------------------------------------------------------------

const empty = JsonTology.create({ 'baseIRI': 'https://example.io', 'schemas': [] as const });

// @ts-expect-error — no schemas registered
empty.parse('https://example.io/User', {});

// ---------------------------------------------------------------------------
// Suppress unused variable warnings
// ---------------------------------------------------------------------------

void _userName, _userAge, _orderId, _orderTotal, _bad1;
void _u2, _o2, _tagLabel;
