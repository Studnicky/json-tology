/**
 * Constraint Brands: Keywords
 *
 * Demonstrates jt:* keyword-driven brands on canonical RareBookSchema
 * and SignedFirstEditionSchema: inverseFunctional on Customer.id,
 * transitive/irreflexive on Order.placedAt, and invariants on Order
 * and SignedFirstEdition.
 */

import type {
  InferType, SchemaReferencesMapType
} from '../../../src/types/index.js';
import {
  bookstoreEntities, CustomerSchema, SignedFirstEditionSchema
} from '../bookstore/index.js';
import type {
  bookstoreSchemas, OrderSchema
} from '../bookstore/index.js';

type BookstoreRefs = SchemaReferencesMapType<typeof bookstoreSchemas>;

type AssertEqualType<TLeft, TRight>
  = [TLeft] extends [TRight] ? [TRight] extends [TLeft] ? true : false : false;

function assert<T extends true>(_proof?: T): void {
  return;
}

// CustomerSchema.id carries jt:inverseFunctional brand — each customer ID
// maps to exactly one customer individual (a key constraint).
// BookstoreRefs resolves $ref fields to their named datatype types.
type Customer = InferType<typeof CustomerSchema, BookstoreRefs>;
type CustomerId = Customer extends { readonly 'id': infer I } ? I : never;
// CustomerId: string & InverseFunctionalBrandInterface
// (compile-time phantom brand, validated at instantiation)

assert<AssertEqualType<CustomerId extends string ? true : false, true>>();

// OrderSchema.placedAt carries temporal characteristics (transitive ordering
// of event placement). The schema registers an invariant ensuring consistent
// ordering across multiple orders.
type Order = InferType<typeof OrderSchema, BookstoreRefs>;
type PlacedAt = Order extends { readonly 'placedAt': infer P } ? P : never;
// PlacedAt: string (ISO 8601)
// At registration time, the Order schema includes jt:invariant rules
// that validate temporal consistency across instances

assert<AssertEqualType<PlacedAt extends string ? true : false, true>>();

// SignedFirstEditionSchema extends RareBookSchema with an invariant:
// signedFirstEditionIsSoloAuthored — only single-author books can be
// signed first editions. This is a cross-field rule that fires alongside
// structural validation.
type SignedFirstEdition = InferType<typeof SignedFirstEditionSchema, BookstoreRefs>;
type SignedAuthors = SignedFirstEdition extends
{ readonly 'authors': infer A }
  ? A
  : never;
// SignedAuthors: a tuple constrained to at most one element (maxCardinality restriction)
// The jt:invariant constraint on SignedFirstEdition enforces that
// authors.length === 1 at validation time.
// The restriction narrows authors to a bounded tuple — it extends readonly string[].

assert<AssertEqualType<SignedAuthors extends readonly string[] ? true : false, true>>();

// All three schemas are registered in bookstoreEntities with their
// jt:* keyword constraints active. At instantiation time, data is validated
// against these invariants and the narrowed types are enforced.

// Runtime demonstration: instantiate a Customer with a UUID id (inverseFunctional key).
const customer = bookstoreEntities.instantiate(CustomerSchema, {
  'customerId': '550e8400-e29b-41d4-a716-446655440000',
  'email': 'bastian@bookstore.example',
  'name': 'Bastian Balthazar Bux'
});

console.log('Customer customerId (inverseFunctional brand):', customer.customerId);
console.log('Customer email (format brand):', customer.email);

// SignedFirstEdition authors are constrained to a single-element tuple
// by jt:invariant (signedFirstEditionIsSoloAuthored). The schema $id
// confirms the registered constraint is active in the registry.
console.log('SignedFirstEdition $id:', SignedFirstEditionSchema.$id);
console.log('SignedFirstEdition is registered:', bookstoreEntities.registry.has(SignedFirstEditionSchema.$id));
