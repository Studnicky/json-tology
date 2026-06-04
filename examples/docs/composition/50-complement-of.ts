/**
 * Compose.complementOf — Example: AvailableBook as the complement of UnavailableBook
 * Demonstrates: complementOf emits owl:complementOf in the OWL TBox.
 *
 * UnavailableBookSchema is a Book subclass with a fixed `available: false`
 * discriminant. AvailableBookSchema is declared as its complement — any Book
 * that is NOT UnavailableBook.
 *
 * The TBox JSON-LD carries:
 *   urn:bookstore:AvailableBook  owl:complementOf  urn:bookstore:UnavailableBook
 */

import {
  Compose, JsonTology
} from '../../../src/index.js';
import { OWL } from '../../../src/constants/IRI.js';
import { BookSchema } from '../bookstore/index.js';

// UnavailableBook — a Book whose `available` flag is false.
const UnavailableBookSchema = Compose.subClassOf(BookSchema, {
  '$id': 'urn:bookstore:UnavailableBook',
  'properties': {
    'available': {
      'const': false,
      'type': 'boolean'
    }
  },
  'required': ['available'],
  'type': 'object'
} as const);

// AvailableBook — the complement of UnavailableBook, bounded to the Book universe.
const AvailableBookSchema = Compose.complementOf(UnavailableBookSchema, {
  '$id': 'urn:bookstore:AvailableBook',
  'allOf': [{ '$ref': BookSchema.$id }],
  'type': 'object'
} as const);

// Register all schemas — Book first, then the subclasses.
const jt = JsonTology.create({
  'baseIRI': 'https://bookstore.example',
  'schemas': [
    BookSchema,
    UnavailableBookSchema,
    AvailableBookSchema
  ] as const
});

// TBox carries owl:complementOf on AvailableBook pointing at UnavailableBook.
const tbox = JSON.parse(jt.toTbox().jsonLd()) as {
  '@graph'?: ReadonlyArray<Record<string, unknown>>;
};
const graph = tbox['@graph'] ?? [];
const availableNode = graph.find((node) => {
  return node['@id'] === AvailableBookSchema.$id;
});

console.assert(availableNode !== undefined, 'AvailableBook appears in TBox');

const complementOf = availableNode?.[OWL.complementOf] as undefined | { '@id': string };

console.assert(
  complementOf !== undefined,
  'AvailableBook carries owl:complementOf'
);
console.assert(
  complementOf?.['@id'] === UnavailableBookSchema.$id,
  'owl:complementOf points to UnavailableBook'
);

console.log(
  'AvailableBook owl:complementOf UnavailableBook:',
  complementOf?.['@id'] === UnavailableBookSchema.$id
);
