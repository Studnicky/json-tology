/**
 * Combine TBox and ABox
 *
 * Merge OWL TBox vocabulary with ABox individual data to create
 * a complete RDF document.
 */

import {
  bookstoreEntities, CustomerSchema
} from '../bookstore/index.js';

// TBox — OntologyBuilder
const tbox = bookstoreEntities.ontology();
// ABox — QuadInterface[]
const abox = bookstoreEntities.toQuads(CustomerSchema, {
  'addresses': [{
    'city': 'München',
    'postalCode': '80538',
    'street': 'Reichenbachstraße 14'
  }],
  'customerId': 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  'email': 'bastian.bux@bookstore.example',
  'name': 'Bastian Balthazar Bux'
});

// Merge for a complete JSON-LD document:
// OWL/SHACL quads from the OntologyBuilder
// ABox individual quads (QuadInterface[] — spread directly)
const merged = {
  '@context': tbox.context(),
  '@graph': [
    ...(tbox.jsonLdObject()['@graph'] as unknown[]),
    ...abox
  ]
};

console.assert(Boolean(merged['@context']), 'context present');
console.assert(merged['@graph'].length > 0, 'graph has content');
