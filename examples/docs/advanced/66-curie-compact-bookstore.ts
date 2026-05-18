/**
 * Curie — compact bookstore IRIs for display.
 *
 * Shrink full IRIs to CURIE form for readable output in debug logs or ontology
 * tooling. When multiple prefixes share an overlap, `compact` picks the longest
 * match. `expand` resolves a compact form back to the full IRI.
 *
 * Demonstrates: Curie.compact / expand with bookstore, owl, and xsd prefixes.
 */

import { Curie } from '../../../src/index.js';
import {
  BookSchema, CustomerSchema, OrderSchema
} from '../bookstore/index.js';

const curie = new Curie({
  'bk': 'https://bookstore.example/',
  'owl': 'http://www.w3.org/2002/07/owl#',
  'xsd': 'http://www.w3.org/2001/XMLSchema#'
});

// Use the registered bookstore baseIRI prefix for compacting display names
const bookIri = `https://bookstore.example/${BookSchema.$id.replace('urn:bookstore:', '')}`;
const customerIri = `https://bookstore.example/${CustomerSchema.$id.replace('urn:bookstore:', '')}`;
const orderIri = `https://bookstore.example/${OrderSchema.$id.replace('urn:bookstore:', '')}`;

console.assert(
  curie.compact(bookIri) === 'bk:Book',
  'Book IRI compacts to bk:Book'
);
console.assert(
  curie.compact(customerIri) === 'bk:Customer',
  'Customer IRI compacts to bk:Customer'
);
console.assert(
  curie.compact(orderIri) === 'bk:Order',
  'Order IRI compacts to bk:Order'
);
console.assert(
  curie.compact('http://www.w3.org/2002/07/owl#Class') === 'owl:Class',
  'OWL Class IRI compacts to owl:Class'
);

// expand inverts compact
console.assert(
  curie.expand('bk:Customer') === 'https://bookstore.example/Customer',
  'bk:Customer expands to full IRI'
);
