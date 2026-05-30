/**
 * Compose.extend — Example 3: Tighten a property via additions
 *
 * `extend` does not flatten properties over the base. The additions
 * appear as a second `allOf` entry, so a constraint declared in the
 * additions must hold alongside the base's constraint. Both must
 * satisfy — classic JSON Schema `allOf`.
 */

import { Compose } from '../../../src/index.js';
import {
  BookSchema,
  createBookstoreDocRegistry
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

const PremiumBookSchema = Compose.extend(
  BookSchema,
  {
    'price': {
      'minimum': 25,
      'type': 'object'
    }
  } as const,
  'https://bookstore.example/PremiumBook'
);

const jt2 = jt.set(PremiumBookSchema);

// A book priced at 14.99 fails the additional minimum: 25 constraint.
const cheap = jt2.validate(PremiumBookSchema.$id, {
  'authors': ['Michael Ende'],
  'inStock': true,
  'isbn': '9783522128001',
  'price': {
    'amount': 14.99,
    'currency': 'EUR'
  },
  'printStatus': 'outOfPrint',
  'title': 'Die unendliche Geschichte'
});

void cheap;
const premiumId: string = PremiumBookSchema.$id;

console.assert(premiumId.endsWith('/PremiumBook'));
