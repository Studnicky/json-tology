/**
 * Advanced Example 106 — typed ABox graph traversal (aboxGraph)
 *
 * Demonstrates the ORM-for-graphs cursor surface: build an in-memory
 * typed graph from ABox quads and navigate it via fluent dot-chaining —
 * forward (objects), inverse (subjects), schema (predicate/class), and
 * closure (subClassOf transitive).
 *
 * The bookstore scenario: customer Bastian Balthazar Bux places an order.
 * The Order carries customerId as a scalar foreign key — the same UUID that
 * inverseFunctionally identifies the Customer. The cursor resolves that FK
 * to the typed Customer without any explicit join.
 */

import {
  aboxFixtures,
  bookstoreEntities,
  CustomerSchema,
  OrderSchema
} from '../bookstore/index.js';
import type { QuadInterface } from '../../../src/interfaces/Quad.js';

// ---------------------------------------------------------------------------
// Build the ABox quad set from the customer + order fixtures.
// The order carries customerId as a scalar FK ($ref to the CustomerId identity
// primitive). Connectivity to the customer depends on the inverse-functional
// identity resolution the cursor derives from the TBox — no schema change
// is required.
// ---------------------------------------------------------------------------

const ABOX_GRAPH_IRI = 'https://bookstore.example/graph/abox';

function bookstoreAboxQuads(): QuadInterface[] {
  const quads: QuadInterface[] = [];

  quads.push(...bookstoreEntities.toQuads(
    CustomerSchema,
    bookstoreEntities.instantiate(CustomerSchema, aboxFixtures.customer),
    { 'graphIRI': ABOX_GRAPH_IRI }
  ));
  quads.push(...bookstoreEntities.toQuads(
    OrderSchema,
    bookstoreEntities.instantiate(OrderSchema, aboxFixtures.order),
    { 'graphIRI': ABOX_GRAPH_IRI }
  ));

  return quads;
}

// Safe cast for lifted unknown instances — avoids any, stays strict.
function record(value: unknown): Record<string, unknown> {
  return value as Record<string, unknown>;
}

const quads = bookstoreAboxQuads();
const graph = bookstoreEntities.aboxGraph(quads);

// ---------------------------------------------------------------------------
// 1. Forward FK resolution: Order → Customer via customerId.
//    objects('customerId') resolves the scalar UUID foreign key to the typed
//    Customer instance through the inverse-functional identity index.
//    first() returns the first typed result or undefined if the cursor is empty.
// ---------------------------------------------------------------------------

const orderIris = graph.instances(OrderSchema.$id)
  .iris();
const orderIri = orderIris.at(0) ?? '';

const customer = record(graph.resource(orderIri).objects('customerId')
  .first());

console.log('FK resolved — customer name:', customer.name);
console.log('FK resolved — customer id  :', customer.customerId);

// ---------------------------------------------------------------------------
// 2. Inverse FK: Customer → all resources that reference it via customerId.
//    subjects('customerId') is the ^ (inverse predicate) direction.
// ---------------------------------------------------------------------------

const customerIris = graph.instances(CustomerSchema.$id)
  .iris();
const customerIri = customerIris.at(0) ?? '';

const referrerCount = graph.resource(customerIri).subjects('customerId')
  .count();

console.log('Inverse FK — referrer count:', referrerCount);

// ---------------------------------------------------------------------------
// 3. Object-property traversal: Order → its shippingAddress.
//    shippingAddress is a direct $ref object property (no FK resolution needed).
// ---------------------------------------------------------------------------

const address = record(graph.resource(orderIri).objects('shippingAddress')
  .first());

console.log('Object property — shipping city   :', address.city);
console.log('Object property — shipping country:', address.country);

// ---------------------------------------------------------------------------
// 4. Schema cursor — predicate range.
//    g.predicate('shippingAddress').range().one() reads the TBox to find the
//    rdfs:range class. The result is the typed Address schema ($id field).
//    Note: array-property ranges yield rdf:List (the RDF collection type);
//    scalar object properties yield the target class directly.
// ---------------------------------------------------------------------------

const rangeSchema = record(graph.predicate('shippingAddress').range()
  .one());

console.log('Schema cursor — range $id:', rangeSchema.$id);

// ---------------------------------------------------------------------------
// 5. Schema cursor — transitive subClassOf.
//    RareBook → PrintBook → Book (two hops). The transitive walk bubbles up
//    through the entire superclass chain.
//    Note: foreign keys resolve only where an inverseFunctional identity is
//    declared, so customerId→Customer resolves; bookIsbn references are a
//    future enhancement pending a declared Book identity property.
// ---------------------------------------------------------------------------

const transitiveSupers = graph.class('urn:bookstore:RareBook')
  .subClassOf({ 'transitive': true })
  .iris();

console.log('Transitive subClassOf includes Book:', transitiveSupers.includes('urn:bookstore:Book'));
console.log('Transitive superclasses:', transitiveSupers.join(', '));
