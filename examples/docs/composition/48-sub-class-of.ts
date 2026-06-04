/**
 * Compose.subClassOf — Example: GenreBook as a subclass of Book
 * Demonstrates: single-parent subClassOf, inherited property materialization,
 * and rdfs:subClassOf emission in the OWL TBox.
 *
 * GenreBookSchema is a subclass of Book with an added `genre` property.
 * Registering via JsonTology.create and calling instantiate() exercises the
 * inherited fields. The TBox JSON-LD carries an rdfs:subClassOf link from
 * GenreBook to Book.
 */

import {
  Compose, JsonTology
} from '../../../src/index.js';
import { RDFS } from '../../../src/constants/IRI.js';
import { BookSchema } from '../bookstore/index.js';

// GenreBook is a Book subclass with one additional own property.
// body.$id must not already appear in the parent schema — no collision here.
const GenreBookSchema = Compose.subClassOf(BookSchema, {
  '$id': 'urn:bookstore:GenreBook',
  'properties': { 'genre': { '$ref': 'urn:bookstore:Title' } },
  'required': ['genre'],
  'type': 'object'
} as const);

// Register both schemas — GenreBook $refs Book so Book must come first.
const jt = JsonTology.create({
  'baseIRI': 'https://bookstore.example',
  'schemas': [
    BookSchema,
    GenreBookSchema
  ] as const
});

// TBox carries rdfs:subClassOf linking GenreBook → Book.
const tbox = JSON.parse(jt.toTbox().jsonLd()) as {
  '@graph'?: ReadonlyArray<Record<string, unknown>>;
};
const graph = tbox['@graph'] ?? [];
const genreNode = graph.find((node) => {
  return node['@id'] === GenreBookSchema.$id;
});

console.assert(genreNode !== undefined, 'GenreBook appears in TBox');

const subClassOf = genreNode?.[RDFS.subClassOf] as ReadonlyArray<{ '@id': string }> | undefined;

console.assert(
  Array.isArray(subClassOf),
  'GenreBook node carries rdfs:subClassOf as array'
);

const refersToBook = (subClassOf ?? []).some((entry) => {
  return entry['@id'] === BookSchema.$id;
});

console.assert(refersToBook, 'rdfs:subClassOf includes Book IRI');

console.log(
  'GenreBook rdfs:subClassOf Book:',
  refersToBook,
  '| subClassOf entries:',
  (subClassOf ?? []).map((entry) => {
    return entry['@id'];
  })
);
