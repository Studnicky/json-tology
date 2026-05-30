/**
 * Compose.partial / Compose.pick against the canonical Customer.
 *
 * Two derived schemas registered onto the canonical bookstore:
 *   • PatchCustomerSchema — every Customer field optional (PATCH body).
 *   • CustomerSummarySchema — id + name only (list-view projection).
 */

import { Compose } from '../../../src/index.js';
import {
  aboxFixtures, createBookstoreDocRegistry,
  CustomerSchema
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

const PatchCustomerSchema = Compose.partial(
  CustomerSchema,
  'https://bookstore.example/PatchCustomer'
);

const CustomerSummarySchema = Compose.pick(
  CustomerSchema,
  [
    'customerId',
    'name'
  ] as const,
  'https://bookstore.example/CustomerSummary'
);

jt.set(PatchCustomerSchema);
jt.set(CustomerSummarySchema);

// These derived schemas are not part of the registry's compile-time schema-ID
// union (registered at runtime via set()), so validate/instantiate receive the
// schema object itself.
const patchErrs = jt.validate(PatchCustomerSchema, { 'name': aboxFixtures.customer.name });

console.assert(patchErrs.length === 0);

const summary = jt.instantiate(CustomerSummarySchema, {
  'customerId': aboxFixtures.customer.customerId,
  'name': aboxFixtures.customer.name
}) as { 'customerId': string;
  'name': string };

console.assert(summary.customerId === aboxFixtures.customer.customerId);
console.assert(summary.name === aboxFixtures.customer.name);
