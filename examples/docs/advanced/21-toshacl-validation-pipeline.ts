/**
 * SHACL-only export for a validation pipeline
 *
 * When you only need SHACL shapes (no OWL), ship the shapes to a downstream
 * SHACL processor without OWL vocabulary leakage.
 */

import {
  BookSchema, bookstoreEntities, CustomerSchema
} from '../bookstore/index.js';

// Ship SHACL to a downstream SHACL processor — no OWL leakage
const shapes = bookstoreEntities.toShacl().shaclObject();

console.assert(Boolean(shapes), 'shacl shapes present');
console.assert(Boolean(BookSchema.$id), 'book schema registered');
console.assert(Boolean(CustomerSchema.$id), 'customer schema registered');

const shaclGraph = (shapes as { '@graph'?: unknown[] })['@graph'];

console.log('SHACL shapes exported:', Array.isArray(shaclGraph) ? shaclGraph.length : 0);
console.log('BookSchema registered at:', BookSchema.$id);
console.log('CustomerSchema registered at:', CustomerSchema.$id);
