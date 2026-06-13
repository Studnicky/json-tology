/**
 * Transform.chain — Example 3: Pairwise stage type safety
 * Demonstrates: correct stage-to-stage type flow (string → number → ISO string)
 *
 * Each stage's output type must match the next stage's input type. Here a
 * millisecond-since-epoch string in the Bastian Balthazar Bux order fixture
 * is parsed through two stages: string → number (ms) → ISO date-time string.
 * The canonical form is a JSON-schema-expressible string.
 */

import { Transform } from '../../../src/index.js';
import {
  aboxFixtures,
  createBookstoreDocRegistry
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

const step1 = {
  'decode': (epochStr: string) => {
    return Number.parseInt(epochStr, 10);
  },
  'encode': String
} as const;

const step2 = {
  'decode': (epochMs: number) => {
    return new Date(epochMs).toISOString();
  },
  'encode': (isoString: string) => {
    return String(new Date(isoString).getTime());
  }
} as const;

// Correct — string → number → ISO string (pairwise types align). The stage tuple
// and terminal output type are inferred from the transforms argument.
const EpochDateSchema = Transform.chain(
  {
    '$id': 'https://bookstore.example/EpochDate',
    'type': 'string'
  } as const,
  [
    step1,
    step2
  ]
);

jt.set(EpochDateSchema);

const orderMs = String(new Date(aboxFixtures.order.placedAt).getTime());
const canonical = jt.instantiate(EpochDateSchema, orderMs);

if (typeof canonical !== 'string') {
  throw new TypeError('Expected string (ISO date-time) from chain decode');
}

const decodedDate = new Date(canonical);

console.assert(decodedDate.getFullYear() === 2026);
// string → number (ms) → ISO string: each stage output feeds the next stage input.
console.log('epoch ms string  :', orderMs);
console.log('canonical ISO    :', canonical);
