/**
 * Registry.set — fluent + bulk forms.
 *
 * `jt.set(schema)` adds one schema; `set([s1, s2, ...])`
 * adds a tuple. Both keep the canonical bookstore as the single source
 * of truth — derived schemas attach to it rather than building a
 * mini-registry.
 */

import { Compose } from '../../../src/index.js';
import {
  createBookstoreDocRegistry,
  CustomerSchema
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

const PatchCustomerSchema = Compose.partial(
  CustomerSchema,
  'https://bookstore.example/RegistrySetPatch'
);
const SummaryCustomerSchema = Compose.pick(
  CustomerSchema,
  [
    'customerId',
    'name'
  ] as const,
  'https://bookstore.example/RegistrySetSummary'
);

jt.set(PatchCustomerSchema);
jt.set(SummaryCustomerSchema);

console.assert(jt.registry.has(PatchCustomerSchema.$id));
console.assert(jt.registry.has(SummaryCustomerSchema.$id));
