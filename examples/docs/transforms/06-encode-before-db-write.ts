/**
 * jt.encode — Example 2: Serialize before database write
 * Demonstrates: encode applied to a canonical ISO string before persisting to wire format
 *
 * The canonical form holds the timestamp as an ISO string. Before writing to the database,
 * the encode step converts it to wire format (here, the same ISO string). The example uses
 * the Bastian Balthazar Bux order fixture from Coreander's antiquariat.
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
      return new Date(isoString).toISOString();
    },
    'encode': (isoString: string) => {
      return isoString;
    }
  }
);

jt.set(PlacedAtDbSchema);

// PlacedAtDbSchema was registered at runtime via set(), so it is not part of
// the registry's compile-time schema-ID union — pass the schema object. The
// transform decodes the ISO string to canonical form.
const canonical = jt.instantiate(
  PlacedAtDbSchema,
  aboxFixtures.order.placedAt
);

// Before writing to DB — encode to wire format.
const placedAtWire = jt.encode(PlacedAtDbSchema, canonical);

console.assert(typeof placedAtWire === 'string');
console.assert(placedAtWire === new Date(aboxFixtures.order.placedAt).toISOString());
console.log('canonical form :', canonical);
// ISO string ready for persistence
console.log('db-ready wire :', placedAtWire);

