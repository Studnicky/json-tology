/**
 * n3 RDF/JS quads consumed directly by fromQuads
 *
 * Parses Turtle for the canonical Bastian-rare-book IRI via the n3 library,
 * narrows the result to spec-compliant rdf/js quads via
 * `Lists.narrowExternalQuads`, and hands them to json-tology unchanged.
 * Any rdf/js-emitting parser (n3, rdflib, etc.) can drive the registry
 * through the same path — terms with full IRIs in `.value` pass through.
 */

import { Parser } from 'n3';
import { Lists } from '../../../src/index.js';
import type { QuadInterface } from '../../../src/interfaces/Quad.js';
import { aboxFixtures } from '../bookstore/index.js';

const isbn = aboxFixtures.rareBook.isbn;
const turtle = `
  <urn:bookstore:rarebook:neverending-1979-thienemann>
    a <urn:bookstore:Book> ;
    <https://bookstore.example/isbn> "${isbn}" ;
    <https://bookstore.example/title> "Die unendliche Geschichte" .
`;

const parser = new Parser();
const rdfQuads = parser.parse(turtle);
const internal: QuadInterface[] = Lists.narrowExternalQuads(rdfQuads);

console.assert(internal.length > 0);
console.assert(typeof internal[0]?.subject.value === 'string');
