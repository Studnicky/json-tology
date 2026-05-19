/**
 * jt.encode — Example 2: Serialize before database write
 * Demonstrates: encode applied to a domain Date before persisting as ISO string
 *
 * After processing an order event the placement timestamp lives as a domain
 * Date object. Before writing to the database the encode step converts it
 * back to an ISO string. The example uses the canonical Bastian Balthazar
 * Bux order fixture from Coreander's antiquariat.
 */

import { Transform } from '../../../src/index.js';
import {
  aboxFixtures,
  createBookstoreDocRegistry
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

const PlacedAtDbSchema = Transform.create(
  {
    '$id': 'https://bookstore.example/PlacedAtDb',
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

jt.set(PlacedAtDbSchema);

const placedDate = jt.instantiate(
  PlacedAtDbSchema.$id,
  aboxFixtures.order.placedAt
) as Date;

// Before writing to DB — encode back to ISO string.
const placedAtWire = jt.encode(PlacedAtDbSchema, placedDate);

console.assert(typeof placedAtWire === 'string');
console.assert(placedAtWire === new Date(aboxFixtures.order.placedAt).toISOString());
