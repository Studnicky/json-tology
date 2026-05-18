/**
 * dumpJson — Example 2: Compact order payload
 * Demonstrates: dumpJson with excludeDefaults produces a shorter JSON string
 *
 * Bastian Balthazar Bux orders the 1979 Thienemann first edition. With
 * `excludeDefaults: true`, any fields equal to their schema defaults are
 * omitted from the JSON string.
 */

import {
  aboxFixtures, bookstoreEntities, OrderSchema
} from '../bookstore/index.js';

const order = bookstoreEntities.instantiate(OrderSchema, aboxFixtures.order);

// Full JSON — all fields including any schema defaults
const fullJson = bookstoreEntities.dumpJson(OrderSchema.$id, order);

// Compact JSON — defaults omitted
const compactJson = bookstoreEntities.dumpJson(OrderSchema.$id, order, { 'excludeDefaults': true });

console.assert(typeof fullJson === 'string');
console.assert(typeof compactJson === 'string');

// Compact should be shorter or equal in length (no defaults, no extra fields)
console.assert(compactJson.length <= fullJson.length);

const compact = JSON.parse(compactJson) as Record<string, unknown>;

// Required fields are always present
console.assert(typeof compact.id === 'string');
console.assert(typeof compact.customerId === 'string');
console.assert(Array.isArray(compact.items));
