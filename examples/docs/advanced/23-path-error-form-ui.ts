/**
 * Path: surface validation error paths in a form UI
 *
 * Convert JSON Pointer paths from ValidationErrors into JS access notation
 * for form libraries that use dot/bracket paths.
 */

import { Path } from '../../../src/index.js';
import {
  bookstoreEntities, OrderSchema
} from '../bookstore/index.js';

// quantity: 0 violates QuantitySchema minimum: 1, so the error path is /orderLines/0/quantity
const errs = bookstoreEntities.validate(OrderSchema.$id, {
  'customerId': 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  'orderId': 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'orderLines': [{
    'bookIsbn': '9780140449136',
    'quantity': 0,
    'unitPrice': {
      'amount': 1499,
      'currency': 'EUR'
    }
  }],
  'orderTotal': {
    'amount': 50,
    'currency': 'EUR'
  },
  'placedAt': '2026-01-15T10:30:00Z',
  'shippingAddress': {
    'city': 'Berlin',
    'country': 'DE',
    'postalCode': '10115',
    'street': 'Unter den Linden 1'
  }
});

for (const err of errs) {
  const accessPath = Path.toAccess(err.path);

  console.assert(typeof accessPath === 'string', `error path converted: ${accessPath}`);
  console.log(`Validation error at ${err.path} => JS access: ${accessPath} (${err.keyword})`);
}
