/**
 * Sub-schema patterns — coercion respects sub-schema constraints
 *
 * Format constraints on a referenced schema apply on the parent's
 * slot. `Transform` decoders registered against the sub-schema's
 * `$id` run on the parent's value too — one decoder, every reference.
 *
 * Demonstrated against the canonical `Iso8601Schema` (referenced by
 * `OrderSchema.placedAt`); the order fixture validates clean, and a
 * malformed value surfaces a `format` error at the `/placedAt` slot.
 */

import {
  aboxFixtures, bookstoreEntities, OrderSchema
} from '../bookstore/index.js';

const okErrs = bookstoreEntities.validate(OrderSchema.$id, aboxFixtures.order);

console.assert(okErrs.length === 0);

const badErrs = [...bookstoreEntities.validate(OrderSchema.$id, {
  ...aboxFixtures.order,
  'placedAt': 'not-a-timestamp'
})];

const formatErr = badErrs.find((err) => {
  return err.keyword === 'format' && err.path === '/placedAt';
});

console.assert(formatErr !== undefined);
