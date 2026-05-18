/**
 * Compose.equivalent — Example 1: Domain alias for the canonical Isbn primitive
 *
 * Demonstrates `Compose.equivalent`: produces a new `$id` that
 * `$ref`s the source. Two structurally-identical schemas with
 * distinct domain names — `PrimaryIsbn` for catalog lookup, the
 * canonical `Isbn` for everything else. OWL emits
 * `owl:equivalentClass`, SHACL emits `sh:node`.
 *
 * The alias registers onto the canonical bookstore via
 * `jt.set()`, so every call goes through the same
 * registry the rest of the docs reference.
 */

import { Compose } from '../../../src/index.js';
import {
  aboxFixtures, createBookstoreDocRegistry,
  IsbnSchema
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

const PrimaryIsbnSchema = Compose.equivalent(IsbnSchema, {
  '$id': 'https://bookstore.example/PrimaryIsbn',
  'description': 'The canonical ISBN used for catalog lookup and ordering.'
} as const);

jt.set(PrimaryIsbnSchema);

// The canonical Bastian-ordered ISBN validates against both schemas.
const isbn = aboxFixtures.rareBook.isbn;

const sourceErrs = jt.validate(IsbnSchema.$id, isbn);
const aliasErrs = jt.validate(PrimaryIsbnSchema.$id, isbn);

console.assert(sourceErrs.length === 0);
console.assert(aliasErrs.length === 0);

// A malformed ISBN fails identically through both names.
const badIsbn = 'not-an-isbn';
const sourceBad = jt.validate(IsbnSchema.$id, badIsbn);
const aliasBad = jt.validate(PrimaryIsbnSchema.$id, badIsbn);

console.assert(sourceBad.length === aliasBad.length);
console.assert(sourceBad.length > 0);
