/**
 * ontology — combined TBox + SHACL via ontology().
 *
 * ontology() is the combined, cached method: TBox classes/properties plus
 * SHACL shapes in a single OntologyBuilder. Use toTbox() or toShacl() when
 * you need only one vocabulary. Use ontology() when you need both.
 */

import { bookstoreEntities } from '../bookstore/index.js';

const builder = bookstoreEntities.ontology();

// OWL JSON-LD (TBox)
const owlJsonLd = builder.jsonLd();

// OWL JSON-LD as a JS object
const owl = builder.jsonLdObject();

// SHACL shapes
const shacl = builder.shaclObject();

// Prefix map
const ctx = builder.context();

// Subsequent calls return the same cached builder
const cached = bookstoreEntities.ontology();

// true — ontology() is cached
console.assert(builder === cached, 'ontology() is cached');
console.log('ontology() cached:', builder === cached);

const owlGraph = (owl as { '@graph'?: unknown[] })['@graph'];
const shaclGraph = (shacl as { '@graph'?: unknown[] })['@graph'];

console.log('TBox classes + properties in @graph:', Array.isArray(owlGraph) ? owlGraph.length : 0);
console.log('SHACL shapes in @graph:', Array.isArray(shaclGraph) ? shaclGraph.length : 0);
console.log('JSON-LD byte length:', owlJsonLd.length);
console.log('owl: prefix:', ctx.owl);
