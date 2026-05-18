/**
 * Compose.omit — Example 3: Derive a schema from one already in the registry
 *
 * `jt.registry.get(id)` retrieves a previously
 * registered schema. We narrow it with `Compose.omit` and register
 * the derivation back onto the same registry.
 */

import { Compose } from '../../../src/index.js';
import {
  BookSchema,
  createBookstoreDocRegistry
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

const retrieved = jt.registry.get(BookSchema.$id);

if (retrieved !== undefined) {
  const BookWithoutStockSchema = Compose.omit(
    retrieved as typeof BookSchema,
    ['inStock'] as const,
    'https://bookstore.example/BookWithoutStock'
  );

  jt.set(BookWithoutStockSchema);

  const result = jt.validate(BookWithoutStockSchema.$id, {
    'authors': ['Michael Ende'],
    'isbn': '9783522115056',
    'price': {
      'amount': 16.99,
      'currency': 'EUR'
    },
    'printStatus': 'inPrint',
    'title': 'Momo'
  });

  console.assert(result.ok);
}
