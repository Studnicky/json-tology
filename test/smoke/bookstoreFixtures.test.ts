import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import {
  bookstoreEntities, CustomerSchema, OrderSchema, RareBookSchema,
  ReviewSchema
} from '../../examples/docs/bookstore/index.js';
import { aboxFixtures } from '../../examples/docs/bookstore/aboxFixtures.js';

void describe('bookstore aboxFixtures', () => {
  void it('customer fixture validates against CustomerSchema', () => {
    const errs = bookstoreEntities.validate(CustomerSchema.$id, aboxFixtures.customer);

    assert.deepEqual([...errs], [], 'customer must validate');
  });

  void it('order fixture validates against OrderSchema (structural + invariant)', () => {
    const errs = bookstoreEntities.validate(OrderSchema.$id, aboxFixtures.order);

    assert.deepEqual([...errs], [], 'order must validate (incl. orderTotalMatchesItems)');
  });

  void it('rareBook fixture validates against RareBookSchema', () => {
    const errs = bookstoreEntities.validate(RareBookSchema.$id, aboxFixtures.rareBook);

    assert.deepEqual([...errs], [], 'rareBook must validate');
  });

  void it('review fixture validates against ReviewSchema', () => {
    const errs = bookstoreEntities.validate(ReviewSchema.$id, aboxFixtures.review);

    assert.deepEqual([...errs], [], 'review must validate');
  });

  void it('tampered order total trips orderTotalMatchesItems invariant', () => {
    const tampered = {
      ...aboxFixtures.order,
      'total': {
        'amount': 999,
        'currency': 'USD'
      }
    };
    const errs = [...bookstoreEntities.validate(OrderSchema.$id, tampered)];

    const invariantErr = errs.find((err) => {
      return err.keyword === 'jt:invariant';
    });

    assert.ok(invariantErr, 'expected jt:invariant error in collection');
    assert.equal(
      (invariantErr as { 'params': { 'invariant': string } }).params.invariant,
      'orderTotalMatchesItems'
    );
    assert.match(invariantErr.message, /does not equal/u);
  });
});
