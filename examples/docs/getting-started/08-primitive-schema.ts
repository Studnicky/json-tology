/**
 * Getting started: primitive schema — named, single source of truth
 *
 * Primitives are small, focused schemas with a `urn:` IRI. Every concept
 * lives in its own file so multiple entity schemas can `$ref` the same
 * primitive without duplicating the validation rule.
 *
 * `CustomerIdSchema` is the canonical UUID primitive for customer identity.
 * It is imported by `CustomerSchema` via `{ $ref: CustomerIdSchema.$id }`.
 */

import { CustomerIdSchema } from '../bookstore/index.js';

// The canonical primitive: type + format, one concept per schema.
const id: string = CustomerIdSchema.$id;

console.assert(id === 'urn:bookstore:CustomerId');

const schemaType: string = CustomerIdSchema.type;
const schemaFormat: string = CustomerIdSchema.format;

console.assert(schemaType === 'string');
console.assert(schemaFormat === 'uuid');
