/**
 * Lift: bridge external n3 RDF/JS quads into json-tology's internal shape
 *
 * Parses Turtle for the canonical Bastian-rare-book IRI via the n3
 * library, then converts each `rdf-js`-shaped quad to json-tology's
 * `QuadInterface` via `Lift.fromQuad`. The resulting array is in the
 * shape `fromQuads()` expects — any rdf/js-emitting parser (n3,
 * rdflib, etc.) can drive the registry through the same bridge.
 */

import { Parser } from 'n3';
import { Lift } from '../../../src/index.js';
import type { QuadInterface } from '../../../src/interfaces/Quad.js';
import { aboxFixtures } from '../bookstore/index.js';

const isbn = aboxFixtures.rareBook.isbn;
const turtle = `
  <urn:bookstore:rarebook:neverending-1979-thienemann>
    a <urn:bookstore:Book> ;
    <urn:bookstore:Book#isbn> "${isbn}" ;
    <urn:bookstore:Book#title> "Die unendliche Geschichte" .
`;

const parser = new Parser();
const rdfQuads = parser.parse(turtle) as unknown[];
const internal: QuadInterface[] = (rdfQuads as Array<{ 'graph'?: string
  'object'?: string;
  'predicate'?: string;
  'subject'?: string; }>).map((quad) => {
  return Lift.fromQuad(quad as Parameters<typeof Lift.fromQuad>[0]);
});

console.assert(internal.length > 0);
console.assert(typeof internal[0]?.subject === 'string');
