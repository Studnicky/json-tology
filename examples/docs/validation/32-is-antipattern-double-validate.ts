/**
 * is — Anti-pattern 2: Checking is() and then immediately coercing
 * Demonstrates: double validation (bad) vs direct instantiate with catch (correct)
 *
 * Bastian Balthazar Bux — valid fixture used to show the correct single-pass pattern.
 */

import { InstantiationError } from '../../../src/index.js';
import {
  aboxFixtures, bookstoreEntities, CustomerSchema
} from '../bookstore/index.js';

// Anti-pattern: is() then instantiate() runs validation twice
// Don't do this
if (bookstoreEntities.is(CustomerSchema, aboxFixtures.customer)) {
  // validates again — redundant
  const _customer = bookstoreEntities.instantiate(CustomerSchema, aboxFixtures.customer);

  void _customer;
}

// Correct approach: instantiate directly; catch the error if invalid
try {
  const customer = bookstoreEntities.instantiate(CustomerSchema, aboxFixtures.customer);

  console.assert(customer.name === aboxFixtures.customer.name);
  console.log('instantiate succeeded:', customer.name);
} catch (error) {
  if (error instanceof InstantiationError) {
    console.assert(false, 'Should not throw for valid fixture');
  }
}
