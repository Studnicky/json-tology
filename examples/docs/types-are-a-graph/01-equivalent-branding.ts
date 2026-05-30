/**
 * Your types are a graph: Compose.equivalent — domain branding
 *
 * `PersonName` is the canonical primitive: `{ type: 'string', minLength: 1,
 * maxLength: 200 }`. `CustomerName` and `AuthorName` are both sibling
 * extensions — they share the same validation rule but are domain-distinct.
 *
 * `Compose.equivalent` creates each as a thin `$ref` over `PersonName`:
 * one compiled validator (no duplication), three class IRIs, and
 * `owl:equivalentClass` arcs in the TBox.
 *
 * The canonical bookstore exports all three. This example exercises the
 * runtime: all three validate the same string, but the TypeScript type
 * system keeps them nominally distinct.
 */

import {
  AuthorNameSchema,
  bookstoreEntities,
  CustomerNameSchema,
  PersonNameSchema
} from '../bookstore/index.js';

// All three share the same underlying validation rule.
const name = 'Cornelia Funke';

const errsPersonName = bookstoreEntities.validate(PersonNameSchema.$id, name);
const errsCustomerName = bookstoreEntities.validate(CustomerNameSchema.$id, name);
const errsAuthorName = bookstoreEntities.validate(AuthorNameSchema.$id, name);

console.assert(errsPersonName.length === 0);
console.assert(errsCustomerName.length === 0);
console.assert(errsAuthorName.length === 0);

// Three distinct IRIs — three class nodes in the TBox. Each `$id` is a
// distinct string literal type, so distinctness is guaranteed at compile time:
// `extends` between any pair resolves to `false`.
type PersonVsCustomer = typeof PersonNameSchema.$id extends typeof CustomerNameSchema.$id ? false : true;
type PersonVsAuthor = typeof PersonNameSchema.$id extends typeof AuthorNameSchema.$id ? false : true;
type CustomerVsAuthor = typeof CustomerNameSchema.$id extends typeof AuthorNameSchema.$id ? false : true;
const _distinctIds: [PersonVsCustomer, PersonVsAuthor, CustomerVsAuthor] = [
  true,
  true,
  true
];

console.assert(_distinctIds.every(Boolean));
