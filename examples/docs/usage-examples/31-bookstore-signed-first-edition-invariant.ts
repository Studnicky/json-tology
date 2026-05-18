/**
 * Bookstore taxonomy — SignedFirstEdition: subclass with a cross-field invariant
 *
 * The canonical `SignedFirstEditionSchema` declares
 * `Compose.subClassOf(RareBook)` and registers a
 * `signedFirstEditionIsSoloAuthored` invariant on the same `$id`. The
 * subclass relation lives in the OWL TBox; the cardinality rule fires
 * on every `validate` / `instantiate` and surfaces in
 * `ValidationErrors` with `keyword: 'jt:invariant'`.
 */

import {
  bookstoreEntities, SignedFirstEditionSchema
} from '../bookstore/index.js';

// Valid single-author signed first edition.
const signed = {
  'authors': ['Michael Ende'],
  'binding': 'hardcover' as const,
  'estimatedAgeYears': 47,
  'firstEditionYear': 1979,
  'inStock': true,
  'isbn': '9783522128001',
  'pageCount': 428,
  'price': {
    'amount': 25_000,
    'currency': 'EUR'
  },
  'printStatus': 'outOfPrint' as const,
  'provenance': 'Signed at Thienemann Verlag launch, Stuttgart, 1979.',
  'publishedOn': '1979-09-01',
  'signedBy': 'Michael Ende',
  'stockLevel': 5,
  'title': 'Die unendliche Geschichte',
  'weightGrams': 980
};

const okErrs = bookstoreEntities.validate(SignedFirstEditionSchema.$id, signed);

console.assert(okErrs.length === 0);

// Multi-author candidate breaks the invariant.
const badErrs = [...bookstoreEntities.validate(SignedFirstEditionSchema.$id, {
  ...signed,
  'authors': [
    'Michael Ende',
    'Co-Author'
  ]
})];

const invariantErr = badErrs.find((err) => {
  return err.keyword === 'jt:invariant';
});

console.assert(invariantErr !== undefined);
console.assert(invariantErr?.path === '/authors');
