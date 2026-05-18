/**
 * EnumValuesType / ExhaustiveType — extract enum values and enforce
 * exhaustive handling at compile time.
 *
 * Uses the canonical `PrintStatusSchema` from the bookstore, whose
 * enum literally is `'inPrint' | 'outOfPrint'`. The switch must cover
 * every literal — `ExhaustiveType<typeof s>` resolves to `never` only
 * if no enum members remain, so a missing case surfaces a compile
 * error.
 */

import type {
  EnumValuesType, ExhaustiveType
} from '../../../src/types/index.js';
import type { PrintStatusSchema } from '../bookstore/index.js';

type PrintStatus = EnumValuesType<typeof PrintStatusSchema>;

function describe(status: PrintStatus): string {
  switch (status) {
    case 'inPrint':
      return 'currently printed';
    case 'limitedRun':
      return 'limited run';
    case 'outOfPrint':
      return 'out of print';
    default:
      return status satisfies ExhaustiveType<typeof status>;
  }
}

console.assert(describe('inPrint') === 'currently printed');
console.assert(describe('outOfPrint') === 'out of print');
console.assert(describe('limitedRun') === 'limited run');
