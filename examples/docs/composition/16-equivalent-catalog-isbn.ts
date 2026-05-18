/**
 * Compose.equivalent — Example 2: Named alias in a composed schema set
 *
 * Registers the alias alongside the source so both IDs are available
 * to validate and instantiate. The two schemas validate identically;
 * the catalog-facing alias carries its own description for catalog
 * tooling.
 */

import { Compose } from '../../../src/index.js';
import {
  aboxFixtures, createBookstoreDocRegistry,
  IsbnSchema
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

const CatalogIsbnSchema = Compose.equivalent(IsbnSchema, {
  '$id': 'https://bookstore.example/CatalogIsbn',
  'description': 'ISBN as used in the public catalog feed.'
} as const);

jt.set(CatalogIsbnSchema);

// Both IDs validate the canonical Neverending Story ISBN identically.
const isbn = aboxFixtures.rareBook.isbn;

const sourceResult = jt.validate(IsbnSchema.$id, isbn);
const aliasResult = jt.validate(CatalogIsbnSchema.$id, isbn);

console.assert(sourceResult.ok);
console.assert(aliasResult.ok);
