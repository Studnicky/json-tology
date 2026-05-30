/**
 * Argument conventions: static counterparts on JsonTology
 *
 * Every instance method has a static counterpart on `JsonTology`. Static
 * methods build a one-shot ephemeral registry containing only the supplied
 * schema, run the operation, and discard the registry. No shared state.
 * No setup required.
 *
 * Use static when you have a self-contained schema with no cross-schema
 * `$ref`. Use instance (bookstoreEntities) when schemas reference each
 * other or when you need invariants and computeds.
 */

import { JsonTology } from '../../../src/index.js';
import {
  aboxFixtures, bookstoreEntities, CustomerSchema, IsbnSchema, OrderSchema
} from '../bookstore/index.js';

// Instance form — reuses the compiled validator from the shared registry.
// CustomerSchema references Address, Email, etc.; those are all registered
// in bookstoreEntities so $refs resolve correctly.
const errs = bookstoreEntities.validate(CustomerSchema.$id, aboxFixtures.customer);

console.assert(errs.length === 0);
console.log('instance validate → errors:', errs.length);

// Static (one-shot) form — builds an ephemeral registry, registers the
// supplied schema, runs the operation, then discards the registry.
// Only works for self-contained schemas with no cross-schema $ref.
// IsbnSchema is a plain string primitive with no external $ref.
const isbnErrs = JsonTology.validate(IsbnSchema, aboxFixtures.rareBook.isbn);

console.assert(isbnErrs.length === 0);
console.log('static validate isbn →', aboxFixtures.rareBook.isbn, '| errors:', isbnErrs.length);

// One-shot instantiate — same pattern: self-contained schema only.
const isbn = JsonTology.instantiate(IsbnSchema, aboxFixtures.rareBook.isbn);

console.assert(isbn === aboxFixtures.rareBook.isbn);
console.log('static instantiate isbn →', isbn);

// One-shot toTbox — ontology from multiple schemas, no registry.
// The returned builder object is always defined; calling .jsonLd() on it
// serializes the TBox.
const tbox = JsonTology.toTbox([
  CustomerSchema,
  OrderSchema
]);

const tboxJson = tbox.jsonLd();

console.log('static toTbox serialized length:', tboxJson.length, 'chars');
