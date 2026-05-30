/**
 * MaterializationError — materialization failed validation.
 *
 * `materialize()` without `enablePartial` fails when the canonical
 * OrderSchema's required fields have no declared defaults — the
 * Bastian-orders fixture's required `id`, `customerId`, `items`,
 * `total`, `placedAt`, and `shippingAddress` cannot be synthesised
 * from zero-values alone.
 */

import { MaterializationError } from '../../../src/index.js';
import {
  bookstoreEntities, OrderSchema
} from '../bookstore/index.js';

try {
  bookstoreEntities.materialize(OrderSchema, {});
} catch (error) {
  if (error instanceof MaterializationError) {
    console.assert(error.code === 'MATERIALIZATION_FAILED');
    console.assert(error.schemaId === OrderSchema.$id);
    console.assert(Array.isArray(error.validationErrors));

    console.log('error.code:', error.code);
    console.log('error.schemaId:', error.schemaId);
    console.log('error.validationErrors:', error.validationErrors);
  }
}
