/**
 * OWL 2 property characteristics — emit owl:*Property axioms via toTbox().
 *
 * The bookstore demonstrates the seven OWL 2 property characteristics
 * through real entities:
 *   SimilarBook.b   symmetric + reflexive
 *   Sequel.predecessor  asymmetric
 *   Order.placedAt  transitive + irreflexive
 *   Customer.id     inverseFunctional
 *
 * Calling toTbox().jsonLd() emits the rdf:type owl:*Property quads on the
 * appropriate property IRIs.
 */

import { bookstoreEntities } from '../bookstore/index.js';

const tboxJsonLd = bookstoreEntities.toTbox().jsonLd();

// The TBox is a JSON-LD string containing class and property declarations.
// Property entries carry @type arrays like:
//   ["owl:ObjectProperty", "owl:SymmetricProperty", "owl:ReflexiveProperty"]
console.assert(typeof tboxJsonLd === 'string', 'TBox JSON-LD emitted');
console.assert(tboxJsonLd.includes('SymmetricProperty'), 'symmetric axioms present');
console.assert(tboxJsonLd.includes('AsymmetricProperty'), 'asymmetric axioms present');
console.assert(tboxJsonLd.includes('TransitiveProperty'), 'transitive axioms present');
console.assert(tboxJsonLd.includes('InverseFunctionalProperty'), 'inverseFunctional axioms present');

console.log('TBox JSON-LD byte length:', tboxJsonLd.length);
console.log('SymmetricProperty present:', tboxJsonLd.includes('SymmetricProperty'));
console.log('AsymmetricProperty present:', tboxJsonLd.includes('AsymmetricProperty'));
console.log('TransitiveProperty present:', tboxJsonLd.includes('TransitiveProperty'));
console.log('InverseFunctionalProperty present:', tboxJsonLd.includes('InverseFunctionalProperty'));
