/**
 * toShacl() — shaclObject() not quads().
 *
 * `toShacl()` returns an `OntologyBuilder` containing only SHACL shapes.
 * For this builder `quads()` is empty — SHACL content lives in `shaclObject()`.
 * Calling `quads()` on a `toShacl()` result always returns an empty array.
 *
 * Demonstrates: quads() is empty for toShacl(); shaclObject() contains content.
 */

import { bookstoreEntities } from '../bookstore/index.js';

const shaclBuilder = bookstoreEntities.toShacl();

// quads() is always empty for a toShacl() builder — SHACL lives in shaclObject()
const owlQuads = shaclBuilder.quads();

console.assert(
  owlQuads.length === 0,
  'toShacl() quads() is empty — SHACL lives in shaclObject()'
);

// shaclObject() contains the SHACL shapes
const shaclContent = shaclBuilder.shaclObject();

console.assert(typeof shaclContent === 'object', 'shaclObject() returns an object');

const graphArray = (shaclContent as { '@graph'?: unknown[] })['@graph'];

console.assert(
  Array.isArray(graphArray) && graphArray.length > 0,
  'shaclObject() @graph contains SHACL node shapes'
);

console.log('toShacl() quads() length:', owlQuads.length);
console.log('shaclObject() @graph length:', Array.isArray(graphArray) ? graphArray.length : 0);
