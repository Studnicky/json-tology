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

// OWL JSON-LD as a JS object
const owl = builder.jsonLdObject();

// SHACL shapes JSON-LD
const shacl = builder.shaclObject();

// Prefix map
const ctx = builder.context();

console.assert(ctx.owl === 'http://www.w3.org/2002/07/owl#', 'owl prefix correct');

void owlJson;
void owl;
void shacl;
