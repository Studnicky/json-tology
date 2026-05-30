/**
 * Bookstore domain: registry orchestrator — JsonTology.create with all schemas
 *
 * The `examples/docs/bookstore/index.ts` file creates the shared
 * `bookstoreEntities` instance with all 31 schemas pre-registered.
 * Primitives register first (required by `$ref` resolution); entities
 * register after because they reference the primitives.
 *
 * `as const` on the `schemas` array is required so TypeScript preserves
 * the literal types needed for `InferType<T>` inference.
 *
 * This example confirms the registry has all expected schemas and can
 * validate concrete ABox data against each entity.
 */

import {
  aboxFixtures,
  AddressSchema,
  bookstoreEntities,
  bookstoreSchemas,
  CustomerSchema,
  OrderLineSchema,
  OrderSchema,
  ReviewSchema
} from '../bookstore/index.js';

// Validate a concrete instance for each entity schema — zero errors
// confirms the schema is registered and its $refs resolve correctly.
const addressErrs = bookstoreEntities.validate(AddressSchema.$id, aboxFixtures.customer.addresses[0]);
const customerErrs = bookstoreEntities.validate(CustomerSchema.$id, aboxFixtures.customer);
const orderErrs = bookstoreEntities.validate(OrderSchema.$id, aboxFixtures.order);
const lineErrs = bookstoreEntities.validate(OrderLineSchema.$id, aboxFixtures.order.orderLines[0]);
const reviewErrs = bookstoreEntities.validate(ReviewSchema.$id, aboxFixtures.review);

console.assert(addressErrs.length === 0);
console.assert(customerErrs.length === 0);
console.assert(orderErrs.length === 0);
console.assert(lineErrs.length === 0);
console.assert(reviewErrs.length === 0);

console.log('registered schemas  :', bookstoreSchemas.length);
console.log('Address errors      :', addressErrs.length);
console.log('Customer errors     :', customerErrs.length);
console.log('Order errors        :', orderErrs.length);
console.log('OrderLine errors    :', lineErrs.length);
console.log('Review errors       :', reviewErrs.length);
// Each validate call exercises $ref resolution across the full registry:
// OrderLine.$ref → Isbn, Quantity, Money; Money.$ref → Amount, CurrencyCode.
console.log('all $refs resolve   : true (zero errors across all five entities)');
