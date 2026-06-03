/**
 * Customer-schema authoring — Example 1
 *
 * The canonical CustomerSchema is composed of named primitives via
 * `$ref`. Each primitive is imported directly from the bookstore
 * registry so there is exactly one source per concept.
 */

import { CustomerSchema } from '../bookstore/index.js';

const id: string = CustomerSchema.$id;

console.assert(id === 'urn:bookstore:Customer');
console.assert(CustomerSchema.required.includes('customerId'));
console.assert(CustomerSchema.required.includes('email'));
console.assert(CustomerSchema.required.includes('name'));
