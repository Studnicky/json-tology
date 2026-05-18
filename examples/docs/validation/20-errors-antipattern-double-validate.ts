/**
 * ValidationErrors — Anti-pattern 1: validate() then instantiate() separately
 * Demonstrates: the bad pattern (double validation) vs the correct catch pattern
 *
 * Bastian Balthazar Bux — valid customer used for the correct path.
 */

import { InstantiationError } from '../../../src/index.js';
import {
  aboxFixtures, bookstoreEntities, CustomerSchema
} from '../bookstore/index.js';

// Anti-pattern: validate then instantiate — validation runs twice
// Don't do this
const errs = bookstoreEntities.validate(CustomerSchema, aboxFixtures.customer);

if (errs.ok) {
  // validates again — redundant
  const _customer = bookstoreEntities.instantiate(CustomerSchema, aboxFixtures.customer);

  void _customer;
}

// Correct approach: instantiate directly; catch InstantiationError if invalid
try {
  const customer = bookstoreEntities.instantiate(CustomerSchema, aboxFixtures.customer);

  console.assert(customer.name === aboxFixtures.customer.name);
} catch (error) {
  if (error instanceof InstantiationError) {
    // same ValidationErrors on InstantiationError
    const problem = error.errors.report();

    console.assert(typeof problem === 'object');
  } else {
    throw error;
  }
}
