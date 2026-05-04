/**
 * coerce — Example 2: InstantiationError handling in a request handler
 * Demonstrates: catch pattern, error views, RFC 7807 report
 */

import { InstantiationError } from '../../../src/index.js';
import {
  CustomerSchema, bookstoreEntities as entities
} from '../bookstore/index.js';

function createCustomer(body: unknown) {
  try {
    return entities.instantiate(CustomerSchema.$id, body);
  } catch (error) {
    if (error instanceof InstantiationError) {
      const problem = error.errors.report({ 'instance': '/customers' });

      // In a real handler: res.status(422).json(problem)
      return problem;
    }
    throw error;
  }
}

const result = createCustomer({
  'email': 'not-an-email',
  'name': 42
});

console.assert(typeof result === 'object');
console.assert('status' in result && (result as { 'status': number }).status === 422);
