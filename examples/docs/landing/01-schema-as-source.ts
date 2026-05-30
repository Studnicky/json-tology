/**
 * Landing page: JSON Schema is the source, not an output
 *
 * The canonical `CustomerSchema` is:
 *
 * - A TypeScript type via `InferType<typeof CustomerSchema>`
 * - A runtime validator via `entities.validate(CustomerSchema, data)`
 * - An OpenAPI 3.1 component (paste into `components.schemas.Customer`)
 * - A JSON Schema draft 2020-12 document (any conforming validator reads it)
 * - An OWL class (via `entities.toTbox()`)
 * - A SHACL shape (via `entities.toShacl()`)
 *
 * The same `as const` object that types your TypeScript is also the
 * wire-format contract for every consumer.
 */

import {
  aboxFixtures, createBookstoreDocRegistry,
  CustomerSchema
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

// The schema literal is also the validator — no separate declaration file.
const errs = jt.validate(CustomerSchema, aboxFixtures.customer);

console.assert(errs.length === 0);

const schemaId: string = CustomerSchema.$id;

console.assert(schemaId === 'urn:bookstore:Customer');

// The same schema literal serializes to valid JSON Schema 2020-12.
const asJson = JSON.stringify(CustomerSchema);

console.assert(asJson.includes('"$id"'));
console.assert(asJson.includes('urn:bookstore:Customer'));

console.log('schema $id:', schemaId);
console.log('validate error count:', errs.length);
console.log('serialized includes $id:', asJson.includes('"$id"'));
