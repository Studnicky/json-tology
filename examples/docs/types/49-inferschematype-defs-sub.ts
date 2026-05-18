/**
 * InferSchemaType — Example: Infer a sub-schema type from $defs.
 *
 * The sub-schema lives inside a parent's `$defs` block and references
 * nothing outside its own keyword set, but if it did, the root
 * provides the resolution scope. InferSchemaType takes the sub-schema
 * as `T` and the parent as `TRoot`.
 */

import type {
  InferSchemaType
} from '../../../src/types/index.js';

const _CatalogSchema = {
  '$defs': {
    'FeaturedBook': {
      'properties': {
        'badge': {
          'enum': [
            'bestseller',
            'new',
            'staff-pick'
          ],
          'type': 'string'
        },
        'isbn': { 'type': 'string' }
      },
      'required': [
        'isbn',
        'badge'
      ],
      'type': 'object'
    }
  },
  '$id': 'https://bookstore.example/Catalog',
  'properties': { 'featured': { '$ref': '#/$defs/FeaturedBook' } },
  'type': 'object'
} as const;

type FeaturedBook = InferSchemaType<
  typeof _CatalogSchema['$defs']['FeaturedBook'],
  typeof _CatalogSchema
>;
// { readonly isbn: string; readonly badge: 'bestseller' | 'new' | 'staff-pick' }

const pick: FeaturedBook = {
  'badge': 'staff-pick',
  'isbn': '9783522128001'
};

console.assert(pick.badge === 'staff-pick');
console.assert(pick.isbn === '9783522128001');
