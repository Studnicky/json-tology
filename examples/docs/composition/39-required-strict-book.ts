/**
 * Compose.required — Example 1: Strict book creation
 *
 * `BookSchema.inStock` carries a default of `true`, so it is
 * effectively optional in the base. `Compose.required` produces a
 * schema where every declared property must be present at validation
 * — useful for admin endpoints that want to catch missing defaults.
 */

import { Compose } from '../../../src/index.js';
import type { InferType } from '../../../src/types/index.js';
import {
  BookSchema,
  createBookstoreDocRegistry
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

const CreateBookSchema = Compose.required(
  BookSchema,
  'https://bookstore.example/CreateBook'
);

type CreateBook = InferType<typeof CreateBookSchema>;

jt.set(CreateBookSchema);

// Missing inStock — fails because Compose.required promotes it.
const missingInStock = jt.validate(CreateBookSchema.$id, {
  'authors': ['Michael Ende'],
  'isbn': '9783522128001',
  'price': {
    'amount': 14.99,
    'currency': 'EUR'
  },
  'printStatus': 'outOfPrint',
  'title': 'Die unendliche Geschichte'
});

console.assert(!missingInStock.ok);

void 0 as unknown as CreateBook;
