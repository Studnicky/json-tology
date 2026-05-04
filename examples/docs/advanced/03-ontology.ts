/**
 * ontology — combined TBox + SHACL via ontology().
 *
 * ontology() is the combined, cached method: TBox classes/properties plus
 * SHACL shapes in a single OntologyBuilder. Use toTbox() or toShacl() when
 * you need only one vocabulary. Use ontology() when you need both.
 */

import { bookstoreEntities as entities } from '../bookstore/index.js';

const builder = entities.ontology();

// OWL JSON-LD (TBox)
const owlJsonLd = builder.jsonLd();

// OWL JSON-LD as a JS object
const owl = builder.jsonLdObject();

// SHACL shapes
const shacl = builder.shaclObject();

// Prefix map
const ctx = builder.context();

// Subsequent calls return the same cached builder
const cached = entities.ontology();

// true — ontology() is cached
void (builder === cached);

void owlJsonLd;
void owl;
void shacl;
void ctx;
void cached;
