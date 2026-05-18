/**
 * Value.diff — Example 3: Audit log entry via diff
 * Demonstrates: isEmpty guard, operations array forwarded to structured logger
 *
 * A generic auditUpdate helper diffs before/after records and emits a
 * structured log entry when changes are detected. The Bastian Balthazar
 * Bux customer record provides the before/after fixture — the email
 * address is updated from the antiquariat-era address to a formal one.
 */

import {
  Operations, Value
} from '../../../src/index.js';
import type { Customer } from '../bookstore/index.js';
import {
  aboxFixtures, bookstoreEntities, CustomerSchema
} from '../bookstore/index.js';

const logEntries: Array<{
  'count': number;
  'ops': unknown;
  'schema': string;
}> = [];

function auditUpdate(schemaId: string, before: unknown, after: unknown): ReturnType<typeof Value.diff> {
  const changes = Value.diff(before, after);

  if (!changes.isEmpty) {
    logEntries.push({
      'count': changes.length,
      'ops': changes.operations,
      'schema': schemaId
    });
  }

  return changes;
}

const before = bookstoreEntities.instantiate(CustomerSchema, aboxFixtures.customer);
const after = bookstoreEntities.instantiate(CustomerSchema, {
  ...aboxFixtures.customer,
  'email': 'bastian.balthazar.bux@bookstore.example'
});

const changes = auditUpdate(CustomerSchema.$id, before, after);

console.assert(!changes.isEmpty);
console.assert(logEntries.length === 1);
console.assert(logEntries[0]?.schema === CustomerSchema.$id);
console.assert((logEntries[0]?.count ?? 0) > 0);
console.assert(changes.operations.some((op) => {
  return op.path === '/email';
}));

// No-op diff does not emit a log entry.
const noChanges = auditUpdate(CustomerSchema.$id, before, before);

console.assert(noChanges.isEmpty);
// still 1 — no second entry
console.assert(logEntries.length === 1);

// Replay the changeset to verify roundtrip.
let reconstructed: unknown = Operations.clone(before);

for (const op of changes.operations) {
  reconstructed = Operations.patch(reconstructed, op);
}

console.assert((reconstructed as Customer).email === 'bastian.balthazar.bux@bookstore.example');
