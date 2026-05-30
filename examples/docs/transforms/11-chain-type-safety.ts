/**
 * Transform.chain — Example 3: Pairwise stage type safety
 * Demonstrates: correct stage-to-stage type flow (string → number → Date)
 *
 * Each stage's output type must match the next stage's input type. Here a
 * millisecond-since-epoch string in the Bastian Balthazar Bux order fixture
 * is parsed through two stages: string → number (ms) → Date.
 */

import { Transform } from '../../../src/index.js';
import {
  aboxFixtures,
  createBookstoreDocRegistry
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

const EpochMsSchema = {
  '$id': 'https://bookstore.example/EpochMsString',
  'type': 'string'
} as const;

const step1 = {
  'decode': (epochStr: string) => {
    return Number.parseInt(epochStr, 10);
  },
  'encode': String
};

const step2 = {
  'decode': (epochMs: number) => {
    return new Date(epochMs);
  },
  'encode': (dateValue: Date) => {
    return dateValue.getTime();
  }
};

// Correct — string → number → Date (pairwise types align). The stage tuple
// and terminal output type are inferred from the transforms argument.
const EpochDateSchema = Transform.chain(
  EpochMsSchema,
  [
    step1,
    step2
  ]
);

jt.set(EpochDateSchema);

const orderMs = String(new Date(aboxFixtures.order.placedAt).getTime());
const decoded = jt.instantiate(EpochDateSchema, orderMs);

if (!(decoded instanceof Date)) {
  throw new TypeError('Expected Date from chain decode');
}

console.assert(decoded.getFullYear() === 2026);
