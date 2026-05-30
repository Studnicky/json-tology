/**
 * Generate OWL JSON-LD for all bookstore schemas
 *
 * ontology() returns a cached OntologyBuilder containing both OWL TBox
 * and SHACL shapes in one document.
 */

import { bookstoreEntities } from '../bookstore/index.js';

const builder = bookstoreEntities.ontology();

// OWL JSON-LD string
const owlJson = builder.jsonLd();

console.log('OWL JSON-LD (first 60 chars):', owlJson.slice(0, 60));

// OWL JSON-LD as a JS object
const owl = builder.jsonLdObject();

// SHACL shapes JSON-LD
const shacl = builder.shaclObject();

// Prefix map
const ctx = builder.context();

console.assert(ctx.owl === 'http://www.w3.org/2002/07/owl#', 'owl prefix correct');

const owlGraph = (owl as { '@graph'?: unknown[] })['@graph'];
const shaclGraph = (shacl as { '@graph'?: unknown[] })['@graph'];

console.log('TBox @graph node count:', Array.isArray(owlGraph) ? owlGraph.length : 0);
console.log('SHACL @graph node count:', Array.isArray(shaclGraph) ? shaclGraph.length : 0);
console.log('owl: prefix:', ctx.owl);
