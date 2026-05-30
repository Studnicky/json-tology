import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  aboxFixtures,
  bookstoreEntities,
  CustomerSchema,
  OrderSchema
} from '../../examples/docs/bookstore/index.js';
import type { QuadInterface } from '../../src/interfaces/Quad.js';

const ABOX_GRAPH_IRI = 'https://bookstore.example/graph/abox';

// Project the customer + order fixtures into one ABox quad set. The order
// carries customerId as a scalar foreign key (a $ref to the CustomerId identity
// primitive), so connectivity to the customer depends on the inverse-functional
// identity resolution the cursor derives from the TBox.
function bookstoreAboxQuads(): QuadInterface[] {
  const jt = bookstoreEntities;
  const quads: QuadInterface[] = [];

  quads.push(...jt.toQuads(
    CustomerSchema,
    jt.instantiate(CustomerSchema, aboxFixtures.customer),
    { 'graphIRI': ABOX_GRAPH_IRI }
  ));
  quads.push(...jt.toQuads(
    OrderSchema,
    jt.instantiate(OrderSchema, aboxFixtures.order),
    { 'graphIRI': ABOX_GRAPH_IRI }
  ));

  return quads;
}

function record(value: unknown): Record<string, unknown> {
  return value as Record<string, unknown>;
}

void test('aboxGraph: objects(foreign key) resolves to the typed target entity', () => {
  const graph = bookstoreEntities.aboxGraph(bookstoreAboxQuads());
  const orderIri = graph.instances(OrderSchema.$id).iris()[0];

  const customer = record(graph.resource(orderIri).objects('customerId')
    .one());

  assert.equal(customer.customerId, aboxFixtures.customer.customerId);
  assert.equal(customer.name, aboxFixtures.customer.name);
});

void test('aboxGraph: subjects(foreign key) is the inverse — what references this entity', () => {
  const graph = bookstoreEntities.aboxGraph(bookstoreAboxQuads());
  const customerIri = graph.instances(CustomerSchema.$id).iris()[0];
  const orderIri = graph.instances(OrderSchema.$id).iris()[0];

  const referrers = graph.resource(customerIri).subjects('customerId')
    .iris();

  assert.ok(referrers.includes(orderIri), 'the Order references the Customer via customerId');
});

void test('aboxGraph: objects(object property) follows a $ref edge to the typed target', () => {
  const graph = bookstoreEntities.aboxGraph(bookstoreAboxQuads());
  const orderIri = graph.instances(OrderSchema.$id).iris()[0];

  const address = record(graph.resource(orderIri).objects('shippingAddress')
    .one());

  assert.equal(address.country, record(aboxFixtures.order.shippingAddress).country);
});

void test('aboxGraph: where / filter / count / some / none refine the selection', () => {
  const graph = bookstoreEntities.aboxGraph(bookstoreAboxQuads());
  const customers = graph.instances(CustomerSchema.$id);

  assert.equal(customers.count(), 1);
  assert.equal(customers.some(), true);
  assert.equal(customers.none(), false);

  const named = customers.where((instance) => {
    return record(instance).name === aboxFixtures.customer.name;
  });

  assert.equal(named.count(), 1);

  const customerType: string = CustomerSchema.$id;

  assert.equal(graph.instances(customerType).ofType(customerType)
    .count(), 1);
});

void test('aboxGraph: one() throws CURSOR_CARDINALITY on an empty selection', () => {
  const graph = bookstoreEntities.aboxGraph(bookstoreAboxQuads());

  assert.throws(
    () => {
      graph.instances('urn:bookstore:NoSuchClass').one();
    },
    (error: unknown) => {
      return (error as { 'code'?: string }).code === 'CURSOR_CARDINALITY';
    }
  );
});

void test('aboxGraph: subgraph(depth) expands the bounded neighbourhood', () => {
  const graph = bookstoreEntities.aboxGraph(bookstoreAboxQuads());
  const orderIri = graph.instances(OrderSchema.$id).iris()[0];

  const oneHop = graph.resource(orderIri).subgraph(1)
    .iris();
  const twoHop = graph.resource(orderIri).subgraph(2)
    .iris();

  assert.ok(oneHop.length > 1, 'one hop reaches the order plus its neighbours');
  assert.ok(twoHop.length >= oneHop.length, 'two hops reach at least as far as one');
});

void test('aboxGraph: union / intersect / distinct compose selections', () => {
  const graph = bookstoreEntities.aboxGraph(bookstoreAboxQuads());
  const customers = graph.instances(CustomerSchema.$id);
  const orders = graph.instances(OrderSchema.$id);

  assert.equal(customers.union(orders).count(), 2);
  assert.equal(customers.intersect(customers).count(), 1);
  assert.equal(customers.union(customers).distinct()
    .count(), 1);
});

void test('aboxGraph: orderBy / limit order and bound the selection', () => {
  const graph = bookstoreEntities.aboxGraph(bookstoreAboxQuads());
  const both = graph.instances(CustomerSchema.$id).union(graph.instances(OrderSchema.$id));

  const ordered = both.orderBy((left, right) => {
    return JSON.stringify(left).length - JSON.stringify(right).length;
  });

  assert.equal(ordered.count(), 2);
  assert.equal(ordered.limit(1).count(), 1);
});

void test('aboxGraph: schema cursors walk rdfs:domain / range / subClassOf', () => {
  const graph = bookstoreEntities.aboxGraph(bookstoreAboxQuads());

  // A single-valued object property's range is the target class. (An array
  // property's RDF range is rdf:List — the collection encoding — so item-type
  // unwrapping is a separate concern; use a scalar object property here.)
  const range = record(graph.predicate('shippingAddress').range()
    .one());

  assert.equal(range.$id, 'urn:bookstore:Address');

  const customerDomain = graph.predicate('customerId').domain()
    .iris();

  assert.ok(customerDomain.includes('urn:bookstore:Customer'), 'customerId domain includes Customer');

  const directSupers = graph.class('urn:bookstore:RareBook').subClassOf()
    .iris();

  assert.ok(directSupers.includes('urn:bookstore:PrintBook'), 'RareBook subClassOf PrintBook');

  const transitiveSupers = graph.class('urn:bookstore:RareBook').subClassOf({ 'transitive': true })
    .iris();

  assert.ok(transitiveSupers.includes('urn:bookstore:Book'), 'RareBook transitively subClassOf Book');

  const properties = graph.class('urn:bookstore:Customer').properties();

  assert.ok(properties.some((predicate) => {
    return predicate.endsWith('customerId');
  }), 'Customer declares customerId');
});
