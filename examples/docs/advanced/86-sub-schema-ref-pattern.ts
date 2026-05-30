/**
 * Sub-schema $ref pattern — name a value, reference it everywhere.
 *
 * Define the constrained value type once as a named schema (`EmailSchema`).
 * Any schema that needs an email field references it via `{ $ref: EmailSchema.$id }`.
 * Changing `EmailSchema` propagates to every consumer simultaneously.
 * `findDuplicates()` will never flag two `$ref` slots as redundant.
 *
 * Demonstrates: EmailSchema referenced from CustomerSchema; both validate
 * against the shared constraint.
 */

import {
  bookstoreEntities,
  CustomerSchema,
  EmailSchema
} from '../bookstore/index.js';

// EmailSchema is the canonical definition of the email value type.
// CustomerSchema references it via $ref — the reference is symbolic, not structural.

// Valid: email passes EmailSchema constraint
const validEmail = 'bastian.bux@bookstore.example';
const customer = {
  'addresses': [],
  'customerId': 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  'email': validEmail,
  'name': 'Bastian Balthazar Bux'
};

const customerResult = bookstoreEntities.validate(CustomerSchema.$id, customer);

// ok is true when the ValidationErrors collection is empty (no errors)
console.assert(customerResult.ok, 'customer with valid email passes validation');

// The email constraint is shared — validate it directly through EmailSchema too
const emailResult = bookstoreEntities.validate(EmailSchema.$id, validEmail);

console.assert(emailResult.ok, 'email value validates directly against EmailSchema');

// Invalid email fails at the customer boundary (error path points at /email)
const invalidCustomer = {
  ...customer,
  'email': 'not-an-email'
};
const invalidResult = bookstoreEntities.validate(CustomerSchema.$id, invalidCustomer);

console.assert(!invalidResult.ok, 'customer with invalid email fails validation');

const hasEmailPointer = invalidResult.items.some((item) => {
  return item.path === '/email';
});

console.assert(
  hasEmailPointer,
  'error path targets /email — the $ref slot in CustomerSchema'
);

console.log('Valid customer — validation ok:', customerResult.ok);
console.log('EmailSchema direct validation ok:', emailResult.ok);
console.log('Invalid email — validation fails:', !invalidResult.ok);
console.log('Error path targets $ref slot /email:', hasEmailPointer);
