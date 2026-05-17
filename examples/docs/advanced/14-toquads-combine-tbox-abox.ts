/**
 * Combine TBox and ABox
 *
 * Merge OWL TBox vocabulary with ABox individual data to create
 * a complete RDF document.
 */

import {
  bookstoreEntities, CustomerSchema
} from '../bookstore/index.js';

const tbox = bookstoreEntities.ontology(); // TBox — OntologyBuilder
const abox = bookstoreEntities.toQuads(CustomerSchema, {
  'addresses': [{
    'city': 'München',
    'postalCode': '80538',
    'street': 'Reichenbachstraße 14'
  }],
  'email': 'bastian.bux@bookstore.example',
  'id': 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  'name': 'Bastian Balthazar Bux'
}); // ABox — QuadInterface[]

// Merge for a complete JSON-LD document:
const merged = {
  '@context': tbox.context(),
  '@graph': [
    ...tbox.raw(), // OWL/SHACL quads from the OntologyBuilder
    ...abox // ABox individual quads (QuadInterface[] — spread directly)
  ]
};

console.assert(merged['@context'], 'context present');
console.assert(merged['@graph'].length > 0, 'graph has content');
