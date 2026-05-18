/**
 * validate — Anti-pattern 1: Check return length then re-instantiate
 * Demonstrates: double validation (bad) vs direct instantiate with catch (correct)
 *
 * Bastian Balthazar Bux — valid fixture used for the correct single-pass pattern.
 */

import { InstantiationError } from '../../../src/index.js';
import {
  aboxFixtures, bookstoreEntities, CustomerSchema
} from '../bookstore/index.js';

// Anti-pattern: validate() then instantiate() — double work
// Don't do this
const errs = bookstoreEntities.validate(CustomerSchema, aboxFixtures.customer);

if (errs.length === 0) {
  // validates again — redundant
  const _customer = bookstoreEntities.instantiate(CustomerSchema, aboxFixtures.customer);

  void _customer;
}

// Correct approach: instantiate directly; validates + applies defaults in one pass
try {
  const customer = bookstoreEntities.instantiate(CustomerSchema, aboxFixtures.customer);

  console.assert(customer.name === aboxFixtures.customer.name);
} catch (error) {
  if (error instanceof InstantiationError) {
    console.assert(false, 'Should not throw for valid fixture');
  }
}
