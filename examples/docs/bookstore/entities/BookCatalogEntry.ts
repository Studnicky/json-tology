/**
 * BookCatalogEntry — demonstrates embedded $id resolution via $defs.
 *
 * The inner Variant definition carries its own $id (urn:bookstore:BookCatalogEntryVariant).
 * The outer $ref in the variants array points to that embedded $id — exercising
 * GraphEngine's embedded-id walk, which resolves $refs to nested $id declarations
 * in $defs without requiring a separate registry entry.
 *
 * Demonstrates:
 *   - $defs with an embedded $id → compile-time InferType resolves via local $defs lookup
 *   - $ref to embedded $id → runtime registry resolves via embedded-id walk
 *   - Cross-reference between a top-level entity and a $defs sub-schema
 */

import { IsbnSchema } from './Isbn.js';

export const BookCatalogEntrySchema = {
  '$defs': {
    'Variant': {
      '$id': 'urn:bookstore:BookCatalogEntryVariant',
      'properties': {
        'kind': {
          'enum': [
            'hardcover',
            'paperback',
            'ebook'
          ],
          'type': 'string'
        },
        'variantPrice': { 'type': 'number' }
      },
      'required': [
        'kind',
        'variantPrice'
      ],
      'type': 'object'
    }
  },
  '$id': 'urn:bookstore:BookCatalogEntry',
  'properties': {
    'isbn': { '$ref': IsbnSchema.$id },
    'variants': {
      'items': { '$ref': 'urn:bookstore:BookCatalogEntryVariant' },
      'type': 'array'
    }
  },
  'required': [
    'isbn',
    'variants'
  ],
  'type': 'object'
} as const;
