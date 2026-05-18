/**
 * OWL property restrictions — Example 1: cardinality / minCardinality / maxCardinality
 *
 * Exercises the six `Compose` restriction builders against the
 * canonical `Book.authors` property — the same property the
 * registered `RareBookSchema` already constrains via
 * `maxCardinality(authors, 1)` and `someValuesFrom(authors, AuthorName)`.
 * Demonstrates how additional restriction-narrowed sibling classes
 * register onto the canonical bookstore.
 *
 * Each derived schema attaches to `` via
 * `jt.set()` so the canonical registry remains the
 * single source of truth.
 */

import { Compose } from '../../../src/index.js';
import {
  AuthorNameSchema, BookSchema,
  createBookstoreDocRegistry
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

const AUTHORS_PROP = 'urn:bookstore:Book#authors';

// cardinality — Book with exactly one author.
const OneAuthorBookSchema = Compose.subClassOf(
  Compose.cardinality(AUTHORS_PROP, 1),
  Compose.subClassOf(BookSchema, {
    '$id': 'https://bookstore.example/OneAuthorBook',
    'type': 'object'
  } as const)
);

// minCardinality + allValuesFrom — Book with two-or-more named authors.
const MultiAuthoredBookSchema = Compose.subClassOf(
  Compose.minCardinality(AUTHORS_PROP, 2),
  Compose.subClassOf(
    Compose.allValuesFrom(AUTHORS_PROP, AuthorNameSchema.$id),
    Compose.subClassOf(BookSchema, {
      '$id': 'https://bookstore.example/MultiAuthoredBook',
      'type': 'object'
    } as const)
  )
);

jt.set(OneAuthorBookSchema);
jt.set(MultiAuthoredBookSchema);

// A solo-authored Michael Ende title passes OneAuthorBook.
const momo = {
  'authors': ['Michael Ende'],
  'inStock': true,
  'isbn': '9783522115056',
  'price': {
    'amount': 16.99,
    'currency': 'EUR'
  },
  'printStatus': 'inPrint',
  'title': 'Momo'
} as const;

const oneAuthorErrs = jt.validate(OneAuthorBookSchema.$id, momo);

console.assert(oneAuthorErrs.length === 0);

// A multi-author anthology (two authors) passes MultiAuthoredBook.
const anthology = {
  'authors': [
    'Michael Ende',
    'Cornelia Funke'
  ],
  'inStock': true,
  'isbn': '9783522115070',
  'price': {
    'amount': 22,
    'currency': 'EUR'
  },
  'printStatus': 'inPrint',
  'title': 'Märchen-Sammelband'
} as const;

const multiErrs = jt.validate(MultiAuthoredBookSchema.$id, anthology);

console.assert(multiErrs.length === 0);
