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
      return new Date(isoString).toISOString();
    },
    'encode': (isoString: string) => {
      return isoString;
    }
  }
);

jt.set(CorrectSchema);

const raw = '2026-04-12T14:23:11.000Z';
const canonical = jt.instantiate(CorrectSchema, raw);

if (typeof canonical !== 'string') {
  throw new TypeError('Expected string (ISO date-time) from decode');
}

const wire = jt.encode(CorrectSchema, canonical);

console.assert(wire === raw);
// Transform.create is the correct API for a single decode/encode pair.
console.log('canonical ISO :', canonical);
console.log('re-encoded    :', wire);
