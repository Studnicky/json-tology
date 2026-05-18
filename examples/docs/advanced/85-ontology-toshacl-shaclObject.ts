/**
 * toShacl() — shaclObject() not raw().
 *
 * `toShacl()` returns an `OntologyBuilder` containing only SHACL shapes.
 * For this builder `raw()` is empty — SHACL content lives in `shaclObject()`.
 * Calling `raw()` on a `toShacl()` result always returns an empty array.
 *
 * Demonstrates: raw() is empty for toShacl(); shaclObject() contains content.
 */

import { bookstoreEntities } from '../bookstore/index.js';

const shaclBuilder = bookstoreEntities.toShacl();

// raw() is always empty for a toShacl() builder — SHACL lives in shaclObject()
const rawQuads = shaclBuilder.raw();

console.assert(
  rawQuads.length === 0,
  'toShacl() raw() is empty — SHACL lives in shaclObject()'
);

// shaclObject() contains the SHACL shapes
const shaclContent = shaclBuilder.shaclObject();

console.assert(typeof shaclContent === 'object', 'shaclObject() returns an object');

const graphArray = (shaclContent as { '@graph'?: unknown[] })['@graph'];

console.assert(
  Array.isArray(graphArray) && graphArray.length > 0,
  'shaclObject() @graph contains SHACL node shapes'
);
