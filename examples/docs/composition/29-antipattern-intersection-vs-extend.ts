/**
 * Compose.intersection — Anti-pattern 1: Using intersection when extend is simpler
 *
 * For simple property merging onto a base schema, `Compose.extend` is
 * the focused tool. Intersection is heavier and signals "all
 * constituent schemas must hold simultaneously" — overkill when the
 * additions don't have their own `required` constraints.
 */

import { Compose } from '../../../src/index.js';
import {
  BookSchema,
  createBookstoreDocRegistry
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

// ✓ Do this — extend is designed for property merging onto a base.
const ExtendedBookSchema = Compose.extend(
  BookSchema,
  { 'badge': { 'type': 'string' } } as const,
  'https://bookstore.example/ExtendedBookCorrect'
);

const jt2 = jt.set(ExtendedBookSchema);

const result = jt2.validate(ExtendedBookSchema.$id, {
  'authors': ['Michael Ende'],
  'badge': 'staff-pick',
  'inStock': true,
  'isbn': '9783522115056',
  'price': {
    'amount': 16.99,
    'currency': 'EUR'
  },
  'printStatus': 'inPrint',
  'title': 'Momo'
});

console.assert(result.ok);
console.log('Compose.extend is simpler for single property addition:', result.ok, '| schema:', ExtendedBookSchema.$id);
