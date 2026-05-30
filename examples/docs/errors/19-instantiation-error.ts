/**
 * InstantiationError — trust-boundary failure on instantiate().
 *
 * The canonical Bastian-orders-Neverending-Story payload is fed
 * through `instantiate()` with two deliberate violations: a
 * non-positive total and a zero-quantity line item. The thrown
 * InstantiationError carries the full `ValidationErrors` collection.
 */

import { InstantiationError } from '../../../src/index.js';
import {
  bookstoreEntities, OrderSchema
} from '../bookstore/index.js';

try {
  bookstoreEntities.instantiate(OrderSchema.$id, {
    'customerId': 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
    'id': '09f8e7d6-c5b4-3210-9876-543210fedcba',
    'items': [{
      'bookIsbn': '9783522128001',
      'quantity': 0,
      'unitPrice': {
        'amount': 12.99,
        'currency': 'EUR'
      }
    }],
    'placedAt': '2026-04-12T14:23:11Z',
    'shippingAddress': {
      'city': 'München',
      'country': 'DE',
      'postalCode': '80331',
      'street': 'Reichenbachstraße 14'
    },
    'total': {
      'amount': -5,
      'currency': 'EUR'
    }
  });
} catch (error) {
  if (error instanceof InstantiationError) {
    console.assert(error.code === 'INSTANTIATION_FAILED');
    console.assert(error.errors.length > 0);

    console.log('error.code:', error.code);
    console.log('error.errors.length:', error.errors.length);
    for (const item of error.errors) {
      console.log(`  path=${item.path}  keyword=${item.keyword}  message=${item.message}`);
    }
  }
}
