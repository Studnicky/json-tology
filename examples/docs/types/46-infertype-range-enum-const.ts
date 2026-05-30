/**
 * InferType — Example: Integer range, enum, and const.
 *
 * Bounded `integer` schemas with both bounds in the 0–50 range produce
 * literal unions automatically. `enum` schemas resolve to the union of
 * their declared values.
 */

import type { InferType } from '../../../src/types/index.js';
import type { ReviewSchema } from '../bookstore/index.js';

// rating: minimum 1, maximum 5 — auto-generates a literal union.
type Rating = InferType<typeof ReviewSchema>['rating'];
// 1 | 2 | 3 | 4 | 5

const _CurrencySchema = {
  '$id': 'https://bookstore.example/Currency',
  'enum': [
    'USD',
    'EUR',
    'GBP',
    'JPY'
  ],
  'type': 'string'
} as const;

type Currency = InferType<typeof _CurrencySchema>;
// 'USD' | 'EUR' | 'GBP' | 'JPY'

const rating: Rating = 4;
const currency: Currency = 'EUR';

// Rating is the literal union 1 | 2 | 3 | 4 | 5 — derived from the
// schema's minimum/maximum bounds. Currency is 'USD' | 'EUR' | 'GBP' | 'JPY'
// — derived from the schema's enum array.
console.log('rating (1..5 literal union):', rating);
console.log('currency (enum union):', currency);
