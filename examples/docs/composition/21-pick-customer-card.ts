/**
 * Compose.pick — Example 2: Customer card for embedding in order responses
 *
 * Picks only display fields off the canonical CustomerSchema to embed
 * inside Order responses without leaking the customer's full address
 * book.
 */

import { Compose } from '../../../src/index.js';
import {
  aboxFixtures, createBookstoreDocRegistry,
  CustomerSchema
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

const CustomerCardSchema = Compose.pick(
  CustomerSchema,
  [
    'id',
    'name',
    'email'
  ] as const,
  'https://bookstore.example/CustomerCard'
);

const jt2 = jt.set(CustomerCardSchema);

const card = jt2.instantiate(CustomerCardSchema.$id, {
  'email': aboxFixtures.customer.email,
  'id': aboxFixtures.customer.id,
  'name': aboxFixtures.customer.name
}) as Record<string, unknown>;

console.assert(card.id === aboxFixtures.customer.id);
console.assert(card.name === 'Bastian Balthazar Bux');
console.assert(!('addresses' in card));
