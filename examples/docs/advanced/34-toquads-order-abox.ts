/**
 * Project an order to ABox quads.
 *
 * toQuads validates the order against OrderSchema, then projects each
 * field through the canonical graph and returns QuadInterface[]. The
 * resulting quads can be passed to an OntologyBuilder via addFromQuads to
 * produce JSON-LD output.
 */

import {
  aboxFixtures, bookstoreEntities, OrderSchema
} from '../bookstore/index.js';

const order = bookstoreEntities.instantiate(OrderSchema, aboxFixtures.order);
const quads = bookstoreEntities.toQuads(OrderSchema, order);

console.assert(quads.length > 0, 'order projected to RDF quads');

const first = quads[0];

console.assert(typeof first.subject.value === 'string', 'first quad carries subject term');
console.assert(typeof first.predicate.value === 'string', 'first quad carries predicate term');

// For richer output (JSON-LD, SHACL composition) pass the quads through
// the ontology builder:
const ontology = bookstoreEntities.ontology().addFromQuads(quads);
const jsonLd = ontology.jsonLd();
const jsonLdObject = ontology.jsonLdObject();

console.assert(typeof jsonLd === 'string', 'JSON-LD string emitted');
console.assert(typeof jsonLdObject === 'object', 'JSON-LD object emitted');
