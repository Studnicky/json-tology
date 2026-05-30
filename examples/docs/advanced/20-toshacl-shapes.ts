/**
 * Generate SHACL shapes JSON-LD from bookstore schemas
 *
 * toShacl() returns a fresh OntologyBuilder containing only SHACL shapes
 * without OWL class/property declarations.
 */

import { bookstoreEntities } from '../bookstore/index.js';

const shaclBuilder = bookstoreEntities.toShacl();

// SHACL shapes JSON-LD object (includes sh: prefix in context)
const shacl = shaclBuilder.shaclObject();

// Prefix map
const ctx = shaclBuilder.context();

console.assert(Boolean(shacl), 'shacl object present');
console.assert(Boolean(ctx.sh), 'sh prefix defined');
