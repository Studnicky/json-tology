/**
 * Transform.chain — Anti-pattern contrast: prefer Transform.create for one step
 * Demonstrates: single decode/encode pair belongs in Transform.create, not chain
 *
 * The anti-pattern uses a chain with a single element. The canonical alternative
 * is Transform.create. Both are shown here to confirm runtime equivalence — the
 * correct form is the Transform.create version. Title fixture is Michael Ende's
 * Die unendliche Geschichte (Thienemann Verlag, 1979).
 */

import { Transform } from '../../../src/index.js';
import { createBookstoreDocRegistry } from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

// ✓ Correct: Transform.create for a single decode/encode pair.
const CorrectSchema = Transform.create(
  {
    '$id': 'https://bookstore.example/SingleStepDateCorrect',
    'format': 'date-time',
    'type': 'string'
  } as const,
  {
    'decode': (isoString: string) => {
      return new Date(isoString);
    },
    'encode': (dateValue: Date) => {
      return dateValue.toISOString();
    }
  }
);

jt.set(CorrectSchema);

const raw = '2026-04-12T14:23:11.000Z';
const decoded = jt.instantiate(CorrectSchema, raw);

if (!(decoded instanceof Date)) {
  throw new TypeError('Expected Date');
}

const wire = jt.encode(CorrectSchema, decoded);

console.assert(wire === raw);
