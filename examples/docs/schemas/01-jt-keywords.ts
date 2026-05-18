/**
 * jt:* keywords — Example 1: registered invariants on canonical OrderSchema
 *
 * `jt:invariant`, `jt:computed`, and friends are first-class extensions
 * the canonical graph understands. This example exercises the two that
 * the canonical bookstore actually carries:
 *
 *   • `orderTotalMatchesItems` — registered invariant on `OrderSchema`
 *     that enforces `total.amount === Σ items[i].unitPrice × quantity`.
 *   • `signedFirstEditionIsSoloAuthored` — registered invariant on
 *     `SignedFirstEditionSchema` that enforces `authors.length === 1`.
 *
 * Both surface in `ValidationErrors` with `keyword: 'jt:invariant'`,
 * the same collection shape as structural errors — so consumers can
 * treat cross-field rules and shape rules through one code path.
 */

import {
  aboxFixtures, bookstoreEntities, OrderSchema, SignedFirstEditionSchema
} from '../bookstore/index.js';

// Canonical fixture passes both structural + invariant checks.
const validOrderErrs = bookstoreEntities.validate(OrderSchema.$id, aboxFixtures.order);

console.assert(validOrderErrs.length === 0);

// Tamper with `total.amount` — invariant fires with `keyword: 'jt:invariant'`.
const tamperedOrder = {
  ...aboxFixtures.order,
  'total': {
    'amount': 1,
    'currency': 'EUR'
  }
};
const tamperedErrs = [...bookstoreEntities.validate(OrderSchema.$id, tamperedOrder)];
const orderInvariantErr = tamperedErrs.find((err) => {
  return err.keyword === 'jt:invariant';
});

console.assert(orderInvariantErr !== undefined);
console.assert((orderInvariantErr as { 'params': { 'invariant': string } }).params.invariant
    === 'orderTotalMatchesItems');

// SignedFirstEdition with two authors — co-author cross-field rule fires.
const twoAuthorSigned = {
  ...aboxFixtures.rareBook,
  'authors': [
    'Michael Ende',
    'Carl Conrad Coreander'
  ],
  'provenance': 'signed at Coreander\'s antiquariat, 1979',
  'signedBy': 'Michael Ende'
};
const signedErrs = [...bookstoreEntities.validate(SignedFirstEditionSchema.$id, twoAuthorSigned)];
const signedInvariantErr = signedErrs.find((err) => {
  return err.keyword === 'jt:invariant';
});

console.assert(signedInvariantErr !== undefined);
console.assert((signedInvariantErr as { 'params': { 'invariant': string } }).params.invariant
    === 'signedFirstEditionIsSoloAuthored');
