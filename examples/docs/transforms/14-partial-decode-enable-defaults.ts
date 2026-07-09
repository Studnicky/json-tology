/**
 * Transform.create — Example: partial decode completed by `enableDefaults`
 * Demonstrates: decode returning Partial<CanonicalShapeType<...>>, the rest
 * filled by schema `default`s when `instantiate` runs with
 * `{ enableDefaults: true }`.
 *
 * `decode` only coerces the one wire field that actually needs conversion —
 * `quantity` arrives as an env-var-style string on a restock request wire —
 * and passes `sku` through untouched. It does not fill `warehouse` or
 * `priority`; those have schema `default`s, and `instantiate` fills them
 * during the validation pass that runs after `decode`.
 */

import { Transform } from '../../../src/index.js';
import { createBookstoreDocRegistry } from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

const RestockRequestSchema = {
  '$id': 'https://bookstore.example/RestockRequest',
  'properties': {
    'priority': {
      'default': 'normal',
      'type': 'string'
    },
    'quantity': {
      'minimum': 1,
      'type': 'integer'
    },
    'sku': { 'type': 'string' },
    'warehouse': {
      'default': 'central',
      'type': 'string'
    }
  },
  'required': [
    'sku',
    'quantity',
    'warehouse',
    'priority'
  ],
  'type': 'object'
} as const;

const RestockRequestCodec = Transform.create(RestockRequestSchema, {
  // Only `quantity` needs conversion — the wire carries it as an env-var-style
  // string. `sku` passes through unchanged. `warehouse` and `priority` are
  // left out entirely: they have schema `default`s, so `enableDefaults: true`
  // fills them after decode runs.
  'decode': (raw: { 'quantity': string;
    'sku': string; }) => {
    return {
      'quantity': Number.parseInt(raw.quantity, 10),
      'sku': raw.sku
    };
  },
  'encode': (value) => {
    return {
      'priority': value.priority,
      'quantity': String(value.quantity),
      'sku': value.sku,
      'warehouse': value.warehouse
    };
  }
});

jt.set(RestockRequestCodec);

const restock = jt.instantiate(
  RestockRequestCodec,
  {
    'quantity': '50',
    'sku': '9780743273565-RESTOCK'
  },
  { 'enableDefaults': true }
);

console.assert(restock.sku === '9780743273565-RESTOCK');
console.assert(restock.quantity === 50, 'wire string "50" coerced to number by decode');
console.assert(restock.warehouse === 'central', 'default filled in after the partial decode ran');
console.assert(restock.priority === 'normal', 'default filled in after the partial decode ran');

// decode returned: { sku: '9780743273565-RESTOCK', quantity: 50 }
console.log('decode returned:', {
  'quantity': 50,
  'sku': '9780743273565-RESTOCK'
});
// instantiate returned (defaults filled after decode): { sku: ..., quantity: 50, warehouse: 'central', priority: 'normal' }
console.log('instantiate returned (defaults filled after decode):', restock);
