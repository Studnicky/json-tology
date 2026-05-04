/**
 * toTbox — generate OWL TBox JSON-LD from bookstore schemas.
 *
 * toTbox() returns an OntologyBuilder containing only OWL class/property
 * declarations derived from the registered schemas. No SHACL shapes.
 */

import { bookstoreJt } from '../bookstore/schemas.js';

const tbox = bookstoreJt.toTbox();

// Full OWL JSON-LD document
const jsonLd = tbox.jsonLd();

// OWL JSON-LD as a plain JS object
const owl = tbox.jsonLdObject();

// Prefix context
const ctx = tbox.context();

// Raw OWL graph nodes
const raw = tbox.raw();

// Inspect — not console output in production code, but fine for doc examples
void jsonLd;
void owl;
void ctx;
void raw;
