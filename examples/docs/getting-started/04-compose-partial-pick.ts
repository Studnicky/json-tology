/**
 * Compose.partial / Compose.pick against the canonical Customer.
 *
 * Two derived schemas registered onto the canonical bookstore:
 *   • PatchCustomerSchema — every Customer field optional (PATCH body).
 *   • CustomerSummarySchema — id + name only (list-view projection).
 */

import { Compose } from '../../../src/index.js';
import {
  aboxFixtures, bookstoreEntities, CustomerSchema
} from '../bookstore/index.js';

const PatchCustomerSchema = Compose.partial(
  CustomerSchema,
  'https://bookstore.example/PatchCustomer'
);

const CustomerSummarySchema = Compose.pick(
  CustomerSchema,
  [
    'id',
    'name'
  ] as const,
  'https://bookstore.example/CustomerSummary'
);

bookstoreEntities.set(PatchCustomerSchema);
bookstoreEntities.set(CustomerSummarySchema);

const patchErrs = bookstoreEntities.validate(PatchCustomerSchema.$id, { 'name': aboxFixtures.customer.name });

console.assert(patchErrs.length === 0);

const summary = bookstoreEntities.instantiate(CustomerSummarySchema.$id, {
  'id': aboxFixtures.customer.id,
  'name': aboxFixtures.customer.name
}) as { 'id': string;
  'name': string };

console.assert(summary.id === aboxFixtures.customer.id);
console.assert(summary.name === aboxFixtures.customer.name);
