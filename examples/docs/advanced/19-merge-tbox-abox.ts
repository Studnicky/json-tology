/**
 * Merge TBox with separately sourced ABox
 *
 * Use toTbox() to get the OWL vocabulary, then combine with separately
 * produced ABox quads (from toQuads or an external reasoner).
 */

import {
  bookstoreEntities, CustomerSchema
} from '../bookstore/index.js';

const tbox = bookstoreEntities.toTbox();
const abox = bookstoreEntities.toQuads(CustomerSchema, {
  'addresses': [{
    'city': 'München',
    'postalCode': '80538',
    'street': 'Reichenbachstraße 14'
  }],
  'email': 'bastian.bux@bookstore.example',
  'id': 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  'name': 'Bastian Balthazar Bux'
});

// OWL class/property declarations
// ABox individual assertions (already a QuadInterface[])
const merged = {
  '@context': tbox.context(),
  '@graph': [
    ...tbox.raw(),
    ...abox
  ]
};

console.assert(merged['@context'], 'context present');
console.assert(merged['@graph'].length > 0, 'graph has triples');
