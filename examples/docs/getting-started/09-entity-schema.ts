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

import type {
  CustomerIdSchema, EmailSchema, PersonNameSchema
} from '../bookstore/index.js';
import { CustomerSchema } from '../bookstore/index.js';

// CustomerSchema references these primitives via $ref — import them
// at type level to verify the dependency chain at compile time.
void 0 as unknown as typeof CustomerIdSchema;
void 0 as unknown as typeof EmailSchema;
void 0 as unknown as typeof PersonNameSchema;

const schemaId: string = CustomerSchema.$id;
const schemaType: string = CustomerSchema.type;

console.assert(schemaId === 'urn:bookstore:Customer');
console.assert(schemaType === 'object');
console.assert(CustomerSchema.required.includes('id'));
console.assert(CustomerSchema.required.includes('email'));
console.assert(CustomerSchema.required.includes('name'));
