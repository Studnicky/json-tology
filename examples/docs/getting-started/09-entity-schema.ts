/**
 * Getting started: entity schema — composed of named primitives via $ref
 *
 * Entity schemas reference primitive schemas by IRI rather than repeating
 * validation rules inline. Every `$ref` value is `SourceSchema.$id` —
 * an explicit named import at the top of the file, never a bare string.
 *
 * `CustomerSchema` composes `CustomerId`, `Email`, and `PersonName` into
 * a single entity with all three fields required.
 */

import { CustomerSchema } from '../bookstore/index.js';

const schemaId: string = CustomerSchema.$id;
const schemaType: string = CustomerSchema.type;

console.assert(schemaId === 'urn:bookstore:Customer');
console.assert(schemaType === 'object');
console.assert(CustomerSchema.required.includes('customerId'));
console.assert(CustomerSchema.required.includes('email'));
console.assert(CustomerSchema.required.includes('name'));

console.log('$id:', schemaId);
console.log('type:', schemaType);
console.log('required:', CustomerSchema.required.join(', '));
