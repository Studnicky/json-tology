/**
 * Registry.set — fluent + bulk forms.
 *
 * `bookstoreEntities.set(schema)` adds one schema; `set([s1, s2, ...])`
 * adds a tuple. Both keep the canonical bookstore as the single source
 * of truth — derived schemas attach to it rather than building a
 * mini-registry.
 */

import { Compose } from '../../../src/index.js';
import {
  bookstoreEntities, CustomerSchema
} from '../bookstore/index.js';

const PatchCustomerSchema = Compose.partial(
  CustomerSchema,
  'https://bookstore.example/RegistrySetPatch'
);
const SummaryCustomerSchema = Compose.pick(
  CustomerSchema,
  [
    'id',
    'name'
  ] as const,
  'https://bookstore.example/RegistrySetSummary'
);

bookstoreEntities.set(PatchCustomerSchema);
bookstoreEntities.set(SummaryCustomerSchema);

console.assert(bookstoreEntities.registry.has(PatchCustomerSchema.$id));
console.assert(bookstoreEntities.registry.has(SummaryCustomerSchema.$id));
