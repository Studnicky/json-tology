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

console.assert(shapes, 'shacl shapes present');
console.assert(BookSchema.$id, 'book schema registered');
console.assert(CustomerSchema.$id, 'customer schema registered');
