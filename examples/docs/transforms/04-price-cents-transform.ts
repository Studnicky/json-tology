/**
 * Transform.create — Example 2: Price in cents to decimal
 * Demonstrates: decode cents → float, encode float → cents, bookstore registry
 *
 * A cents-based integer schema registers onto the canonical bookstore. The
 * fixture price is the cover price of Cornelia Funke's Tintenherz (Cecilie
 * Dressler Verlag, 2003) in EUR cents — 1499 → 14.99 after decode.
 */

import { Transform } from '../../../src/index.js';
import { createBookstoreDocRegistry } from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

const PriceCentsSchema = Transform.create(
  {
    '$id': 'https://bookstore.example/PriceCents',
    'minimum': 0,
    'type': 'number'
  } as const,
  {
    'decode': (cents: number) => {
      return cents / 100;
    },
    'encode': (dollars: number) => {
      return Math.round(dollars * 100);
    }
  }
);

jt.set(PriceCentsSchema);

const price = jt.instantiate(PriceCentsSchema, 1499);

console.assert(price === 14.99);

// 1499 cents decoded to EUR: 14.99
console.log('1499 cents decoded to EUR:', price);

const wire = jt.encode(PriceCentsSchema, price);

console.assert(wire === 1499);
console.log('14.99 EUR encoded to cents:', wire);
