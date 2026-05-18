/**
 * Customer-schema authoring — Example 1
 *
 * The canonical CustomerSchema is composed of named primitives via
 * `$ref`. Each primitive is imported directly from the bookstore
 * registry so there is exactly one source per concept.
 */

import type {
  CustomerIdSchema, EmailSchema, PersonNameSchema
} from '../bookstore/index.js';
import { CustomerSchema } from '../bookstore/index.js';

void 0 as unknown as typeof CustomerSchema;
void 0 as unknown as typeof CustomerIdSchema;
void 0 as unknown as typeof EmailSchema;
void 0 as unknown as typeof PersonNameSchema;

const id: string = CustomerSchema.$id;

console.assert(id === 'urn:bookstore:Customer');
console.assert(CustomerSchema.required.includes('id'));
console.assert(CustomerSchema.required.includes('email'));
console.assert(CustomerSchema.required.includes('name'));
