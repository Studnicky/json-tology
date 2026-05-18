/**
 * Compose.extend — Example 2: Featured book with display info
 *
 * Layers two display-only fields onto BookSchema. Inherited
 * properties (isbn, title, authors, price, printStatus) flow through
 * the `$ref` to Book, and the additional `badge` / `position` fields
 * sit alongside.
 */

import { Compose } from '../../../src/index.js';
import {
  BookSchema,
  createBookstoreDocRegistry
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

const FeaturedBookSchema = Compose.extend(
  BookSchema,
  {
    'badge': {
      'enum': [
        'bestseller',
        'new',
        'staff-pick'
      ],
      'type': 'string'
    },
    'position': {
      'minimum': 1,
      'type': 'integer'
    }
  } as const,
  'https://bookstore.example/FeaturedBook'
);

jt.set(FeaturedBookSchema);

const featured = jt.instantiate(FeaturedBookSchema.$id, {
  'authors': ['Michael Ende'],
  'badge': 'bestseller',
  'inStock': true,
  'isbn': '9783522128001',
  'position': 1,
  'price': {
    'amount': 14.99,
    'currency': 'EUR'
  },
  'printStatus': 'outOfPrint',
  'title': 'Die unendliche Geschichte'
}) as Record<string, unknown>;

console.assert(featured.badge === 'bestseller');
console.assert(featured.isbn === '9783522128001');
console.assert(featured.position === 1);
