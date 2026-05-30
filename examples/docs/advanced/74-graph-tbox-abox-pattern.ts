/**
 * TBox vs ABox — schema layer vs data layer.
 *
 * The TBox (Terminological Box) describes the shape of the world: class
 * declarations, property declarations, domain and range. The ABox
 * (Assertional Box) describes instances: typed individuals, property values.
 *
 * `toTbox()` emits the TBox; `toQuads(schema, data)` emits the ABox for a
 * given instance; `fromQuads(schemaId, quads)` lifts ABox quads back to
 * typed objects.
 *
 * Demonstrates: TBox output, ABox quad projection, and fromQuads round-trip
 * using the bookstore Customer schema.
 */

import {
  aboxFixtures, bookstoreEntities, CustomerSchema
} from '../bookstore/index.js';

// TBox — OWL class + property declarations for all registered schemas
const tbox = bookstoreEntities.toTbox();

console.assert(typeof tbox.jsonLd() === 'string', 'TBox emits JSON-LD string');

// ABox — RDF quads about a specific customer instance
const abox = bookstoreEntities.toQuads(CustomerSchema, aboxFixtures.customer);

console.assert(abox.length > 0, 'ABox quad projection emits quads');

// fromQuads — lift ABox quads back to typed Customer objects
// Use the string key form for full type inference on the returned array.
const recovered = bookstoreEntities.fromQuads(CustomerSchema.$id, abox);

console.assert(recovered.length > 0, 'fromQuads recovers at least one Customer');
console.assert(
  recovered[0].email === aboxFixtures.customer.email,
  'recovered Customer has correct email'
);
