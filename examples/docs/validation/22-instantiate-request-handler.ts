/**
 * instantiate — Example 2: Coerce as part of a request handler
 * Demonstrates: InstantiationError catch pattern, .errors.report() RFC 7807
 *
 * Simulates an HTTP handler receiving invalid customer data and returning
 * a structured 422 response rather than an uncaught exception.
 */

import { InstantiationError } from '../../../src/index.js';
import {
  bookstoreEntities, CustomerSchema
} from '../bookstore/index.js';

function createCustomer(body: unknown): unknown {
  try {
    return bookstoreEntities.instantiate(CustomerSchema.$id, body);
  } catch (error) {
    if (error instanceof InstantiationError) {
      return {
        'body': error.errors.report({ 'instance': '/customers' }),
        'status': 422
      };
    }
    throw error;
  }
}

// Invalid body: email is not an email, name is a number
const result = createCustomer({
  'email': 'not-an-email',
  'id': 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  'name': 42
});

console.assert(typeof result === 'object' && result !== null);
console.assert((result as { 'status': number }).status === 422);
console.assert(typeof (result as { 'body': unknown }).body === 'object');
