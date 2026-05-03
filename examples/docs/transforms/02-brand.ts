/**
 * Transform.brand — Example 1: Nominally distinct Customer vs Order IDs
 * Demonstrates: compile-time brand, BrandOutputType, coerce to obtain branded value
 */

import {
  JsonTology, Transform
} from '../../../src/index.js';

const CustomerIdSchema = Transform.brand(
  {
    '$id': 'https://bookstore.example/CustomerId',
    'format': 'uuid',
    'type': 'string'
  } as const,
  'CustomerId'
);

const OrderIdSchema = Transform.brand(
  {
    '$id': 'https://bookstore.example/OrderId',
    'format': 'uuid',
    'type': 'string'
  } as const,
  'OrderId'
);


const localJt = JsonTology.create({
  'baseIRI': 'https://bookstore.example',
  'schemas': [
    CustomerIdSchema,
    OrderIdSchema
  ] as const
});

// Both are strings at runtime
const cid = localJt.coerce(CustomerIdSchema.$id, 'c1a2b3d4-e5f6-7890-abcd-ef1234567890');
const oid = localJt.coerce(OrderIdSchema.$id, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890');

console.assert(typeof cid === 'string');
console.assert(typeof oid === 'string');
// At compile time: CustomerId ≠ OrderId — type-level protection
