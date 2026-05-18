/**
 * Compose.equivalent — Anti-pattern 2: Registering only the alias
 *
 * `CatalogIsbn` `$ref`s `Isbn`, so the source must be registered
 * alongside the alias. Otherwise ref resolution surfaces a
 * `GraphError` on first use of the alias.
 */

import {
  Compose, JsonTology
} from '../../../src/index.js';
import { IsbnSchema } from '../bookstore/index.js';

const CatalogIsbnSchema = Compose.equivalent(IsbnSchema, { '$id': 'https://bookstore.example/CatalogIsbn' } as const);

// ✓ Register the source alongside the alias so $ref resolution succeeds.
const jt = JsonTology.create({
  'baseIRI': 'https://bookstore.example',
  'schemas': [
    IsbnSchema,
    CatalogIsbnSchema
  ] as const
});

const result = jt.validate(CatalogIsbnSchema.$id, '9783522128001');

console.assert(result.ok);
