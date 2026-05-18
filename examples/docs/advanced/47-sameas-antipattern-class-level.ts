/**
 * Anti-pattern: using sameAs for class-level identity.
 *
 * owl:sameAs is for individuals; OWL forbids it between class URIs.
 * Use Compose.equivalent for class-level identity instead — it produces
 * an owl:equivalentClass axiom.
 */

import { Compose } from '../../../src/index.js';
import {
  BookSchema, bookstoreEntities
} from '../bookstore/index.js';

// WRONG — sameAs is for individuals; passing class IRIs produces
// invalid RDF (OWL DL rejects owl:sameAs between class URIs).
bookstoreEntities.sameAs(
  'https://bookstore.example/Book',
  'https://bookstore.example/CatalogItem'
);

// RIGHT — use Compose.equivalent for class-level identity.
const CatalogItemSchema = Compose.equivalent(BookSchema, { '$id': 'https://bookstore.example/CatalogItem' });

console.assert(CatalogItemSchema.$id === 'https://bookstore.example/CatalogItem', 'class alias defined');
console.assert(CatalogItemSchema.$ref === BookSchema.$id, 'thin $ref alias of Book');
