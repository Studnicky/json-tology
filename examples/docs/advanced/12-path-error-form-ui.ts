/**
 * Path: surface validation error paths in a form UI
 *
 * Convert JSON Pointer paths from ValidationErrors into JS access notation
 * for form libraries that use dot/bracket paths.
 */

import { Path } from 'json-tology';
import {
  bookstoreEntities, OrderSchema
} from '../bookstore/index.js';

const errs = bookstoreEntities.validate(OrderSchema.$id, {
  'customerId': 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  'id': 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'items': [{
    'bookIsbn': '9780140449136',
    'quantity': 0,
    'unitPrice': { 'amount': 1499 }
  }],
  'placedAt': '2026-01-15T10:30:00Z',
  'total': { 'amount': 50 }
});

for (const err of errs) {
  const accessPath = Path.toAccess(err.path);

  console.assert(typeof accessPath === 'string', `error path converted: ${accessPath}`);
}
