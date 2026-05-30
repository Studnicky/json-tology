/**
 * Good combinations — bookstore patterns that demonstrate the legal
 * pairings of OWL 2 property characteristics.
 *
 *   SimilarBook.b           symmetric + reflexive
 *   Sequel.predecessor      asymmetric
 *   Order.placedAt          transitive + irreflexive
 *
 * All three live in the registered bookstore graph. Re-exporting them
 * here keeps the docs example anchored to the real schemas.
 */

import {
  bookstoreEntities, OrderSchema, SequelSchema, SimilarBookSchema
} from '../bookstore/index.js';

// SimilarBook.b — symmetric + reflexive (book similarity is mutual and
// every book is trivially similar to itself).
console.assert(SimilarBookSchema.properties.b.symmetric, 'SimilarBook.b symmetric');
console.assert(SimilarBookSchema.properties.b.reflexive, 'SimilarBook.b reflexive');

// Sequel.predecessor — asymmetric (if Book A is the predecessor of Book B,
// then Book B is not the predecessor of Book A).
console.assert(SequelSchema.properties.predecessor.asymmetric, 'Sequel.predecessor asymmetric');

// Order.placedAt — transitive + irreflexive (timestamp ordering composes;
// an order cannot precede itself).
console.assert(OrderSchema.properties.placedAt.transitive, 'Order.placedAt transitive');
console.assert(OrderSchema.properties.placedAt.irreflexive, 'Order.placedAt irreflexive');

// All three propagate into the registered graph's TBox output.
const tboxJsonLd = bookstoreEntities.toTbox().jsonLd();

console.assert(tboxJsonLd.includes('SymmetricProperty'), 'SymmetricProperty emitted');
console.assert(tboxJsonLd.includes('AsymmetricProperty'), 'AsymmetricProperty emitted');
console.assert(tboxJsonLd.includes('TransitiveProperty'), 'TransitiveProperty emitted');

console.log('SimilarBook.b symmetric:', SimilarBookSchema.properties.b.symmetric);
console.log('Sequel.predecessor asymmetric:', SequelSchema.properties.predecessor.asymmetric);
console.log('Order.placedAt transitive:', OrderSchema.properties.placedAt.transitive);
console.log('Order.placedAt irreflexive:', OrderSchema.properties.placedAt.irreflexive);
console.log('All three characteristics emitted in TBox: true');
