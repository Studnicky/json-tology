/**
 * LooseInputType — Signature
 *
 * The canonical declaration of LooseInputType<T>: strips constraint
 * brands from a schema-inferred type, returning the underlying
 * TypeScript primitive. `string & FormatBrand<'email'>` becomes
 * `string`; `number & MinimumBrand<0>` becomes `number`; object and
 * array types fall back to `Record<string, unknown>` and
 * `readonly unknown[]` respectively.
 */

import type {
  InferType, LooseInputType
} from '../../../src/types/index.js';
import type {
  CustomerSchema, ReviewSchema
} from '../bookstore/index.js';

// Type declaration mirrors the canonical export in src/types/Infer.ts:
//
// export type LooseInputType<T>
//   = [T] extends [string] ? string
//     : [T] extends [number] ? number
//       : [T] extends [boolean] ? boolean
//         : [T] extends [readonly unknown[]] ? readonly unknown[]
//           : [T] extends [Record<string, unknown>] ? Record<string, unknown>
//             : unknown;

type Customer = InferType<typeof CustomerSchema>;
type Review = InferType<typeof ReviewSchema>;

// Object → Record<string, unknown>
type LooseCustomer = LooseInputType<Customer>;

// Branded string field → plain string
type LooseRating = LooseInputType<Review['rating']>;

const looseCustomer: LooseCustomer = {
  'email': 'bastian@neverending.example',
  'id': '00000000-0000-0000-0000-000000000001',
  'name': 'Bastian Balthazar Bux'
};
const looseRating: LooseRating = 5;

console.assert(typeof looseCustomer === 'object');
console.assert(typeof looseRating === 'number');
