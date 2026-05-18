/**
 * Equivalence and owl:equivalentClass — Compose.equivalent produces a name alias.
 *
 * `Compose.equivalent(source, additions)` creates a thin `$ref` alias schema.
 * The OWL projection emits `owl:equivalentClass` for the two class IRIs.
 * Instances satisfying the source also satisfy the alias and vice versa.
 *
 * Demonstrates: Compose.equivalent on IsbnSchema to model a PrimaryIsbn alias;
 * TBox carries both class IRIs and both validate the same data.
 */

import {
  Compose,
  JsonTology
} from '../../../src/index.js';
import { IsbnSchema } from '../bookstore/index.js';

// PrimaryIsbn is a domain-distinct alias for Isbn — same validation, distinct name
const PrimaryIsbnSchema = Compose.equivalent(IsbnSchema, {
  '$id': 'urn:bookstore:PrimaryIsbn',
  'description': 'The canonical ISBN used for catalog indexing'
});

// doc example with synthetic fixture schemas (strict-graph default does not throw because no inline duplicates)
const jt = JsonTology.create({
  'baseIRI': 'https://bookstore.example',
  'schemas': [
    IsbnSchema,
    PrimaryIsbnSchema
  ] as const
});

// Both validate the same valid ISBN-13 for Die unendliche Geschichte
const isbn = '9783522128001';

const isbnResult = jt.validate(IsbnSchema.$id, isbn);
const primaryResult = jt.validate(PrimaryIsbnSchema.$id, isbn);

// ok is true when the ValidationErrors collection is empty (no errors)
console.assert(isbnResult.ok, 'Isbn validates the ISBN');
console.assert(primaryResult.ok, 'PrimaryIsbn (equivalent) validates the same ISBN');

// Both reject invalid data
const invalid = 'not-an-isbn';
const isbnInvalid = jt.validate(IsbnSchema.$id, invalid);
const primaryInvalid = jt.validate(PrimaryIsbnSchema.$id, invalid);

console.assert(!isbnInvalid.ok, 'Isbn rejects invalid input');
console.assert(!primaryInvalid.ok, 'PrimaryIsbn (equivalent) also rejects invalid input');
