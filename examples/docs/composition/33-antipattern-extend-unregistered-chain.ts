/**
 * Compose.extend — Anti-pattern 2: Using a derived schema before registering
 *
 * `Compose.extend` returns a new schema object; you can chain further
 * extensions off it. But every derived schema you call `instantiate`
 * or `validate` against must first be registered onto the bookstore
 * via `jt.set()`.
 */

import { Compose } from '../../../src/index.js';
import {
  createBookstoreDocRegistry,
  CustomerSchema
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

const ASchema = Compose.extend(
  CustomerSchema,
  { 'memberSince': { 'type': 'string' } } as const,
  'https://bookstore.example/CustomerA'
);

const BSchema = Compose.extend(
  ASchema,
  { 'pointsBalance': { 'type': 'number' } } as const,
  'https://bookstore.example/CustomerB'
);

// ✓ Register before use — only then is the derived schema reachable.
const jt2 = jt.set(ASchema).set(BSchema);

const result = jt2.validate(BSchema.$id, {
  'addresses': [],
  'email': 'bastian.bux@bookstore.example',
  'id': 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  'memberSince': '2019-04-01',
  'name': 'Bastian Balthazar Bux',
  'pointsBalance': 240
});

console.assert(result.ok);
