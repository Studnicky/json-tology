/**
 * toShacl — generate SHACL shapes JSON-LD from bookstore schemas.
 *
 * toShacl() returns an OntologyBuilder containing only SHACL node shapes and
 * property shapes derived from the registered schemas. No OWL TBox quads.
 */

import { bookstoreEntities as entities } from '../bookstore/index.js';

const shaclBuilder = entities.toShacl();

// SHACL shapes as a JSON-LD object
const shaclObject = shaclBuilder.shaclObject();

// Prefix context (includes sh: prefix)
const ctx = shaclBuilder.context();

// The raw TBox graph is empty — toShacl() contains only SHACL
const raw = shaclBuilder.raw();

void shaclObject;
void ctx;
void raw;
