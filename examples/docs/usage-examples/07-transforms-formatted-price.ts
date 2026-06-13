/**
 * Transforms recipes — formatted price string ↔ number via Transform.chain
 *
 * Wire format: `'$1,234.56'`. Two stages run left-to-right on decode;
 * encoders run right-to-left. Registered against a new
 * `FormattedPrice` primitive sibling of the bookstore `AmountSchema`
 * so the canonical amount primitive stays as a bare number.
 *
 * The wire value is a formatted print of the rare-book price for the
 * 1979 Thienemann first edition of Michael Ende's Die unendliche
 * Geschichte (EUR 850).
 */

import { Transform } from '../../../src/index.js';
import {
  aboxFixtures,
  createBookstoreDocRegistry
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

const FormattedPriceTransform = Transform.chain(
  {
    '$id': 'https://bookstore.example/FormattedPrice',
    'type': 'number'
  } as const,
  [
    {
      'decode': (raw: string) => {
        return raw.replaceAll(/[$,]/gu, '');
      },
      'encode': (clean: string) => {
        return `$${clean}`;
      }
    },
    {
      'decode': (clean: string) => {
        return Number.parseFloat(clean);
      },
      'encode': (value: number) => {
        return value.toFixed(2);
      }
    }
  ] as const
);

jt.set(FormattedPriceTransform);

const wireAmount = aboxFixtures.rareBook.price.amount;
const wire = `$${wireAmount.toFixed(2)}`;
const parsed = jt.instantiate(FormattedPriceTransform, wire);

console.assert(parsed === wireAmount);
// e.g. '$850.00'
console.log('wire string:', wire);
// 850 — stage 1 strips '$', stage 2 parses
console.log('parsed number:', parsed);

const reEncoded = jt.encode(FormattedPriceTransform, wireAmount);

// Encoder collapses thousands separators by design; round-trip is
// numerically faithful, formatting-wise lossy (no thousand-separator
// re-insertion on the way out).
console.assert(reEncoded === `$${wireAmount.toFixed(2)}`);
// '$850.00' — encoders run right-to-left
console.log('re-encoded:', reEncoded);
