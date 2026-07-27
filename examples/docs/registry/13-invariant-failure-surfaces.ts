/**
 * addInvariant — Example 2: Invariant failure surfaces in validate(), instantiate(), is()
 * Demonstrates: jt:invariant keyword in ValidationErrors, is() → false, instantiate() throws
 *
 * The canonical bookstore registry already registers the `orderTotalMatchesItems`
 * invariant on OrderSchema. A tampered order — total claims €1000 when items
 * sum to €850 — triggers the invariant through all three validation surfaces.
 */

import {
  InstantiationError
} from '../../../src/index.js';
import {
  aboxFixtures, bookstoreEntities, OrderSchema
} from '../bookstore/index.js';

const badOrder = {
  ...aboxFixtures.order,
  'orderTotal': {
    // wrong — items sum to 850
    'amount': 1000,
    'currency': 'EUR'
  }
};

// validate() — invariant failure as ValidationErrorEntity.Type with keyword: 'jt:invariant'
const errs = bookstoreEntities.validate(OrderSchema.$id, badOrder);

console.assert(!errs.ok);
console.assert(errs.items.some((errItem) => {
  return errItem.keyword === 'jt:invariant';
}));
console.assert(errs.items.some((errItem) => {
  return errItem.message.includes('does not equal');
}));

// is() — returns false when invariant fails
console.assert(!bookstoreEntities.is(OrderSchema.$id, badOrder));

// instantiate() — throws InstantiationError carrying the same ValidationErrors
let threw = false;

try {
  bookstoreEntities.instantiate(OrderSchema.$id, badOrder);
} catch (error) {
  threw = error instanceof InstantiationError;
}

console.assert(threw);

const invariantErrors = errs.items.filter((errItem) => {
  return errItem.keyword === 'jt:invariant';
});

console.log('validate() ok:', errs.ok);
console.log('invariant errors:', invariantErrors.map((errItem) => {
  return errItem.message;
}));
console.log('is() result:', bookstoreEntities.is(OrderSchema.$id, badOrder));
console.log('instantiate() threw InstantiationError:', threw);
