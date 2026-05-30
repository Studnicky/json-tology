/**
 * NonDeprecatedSchemaType — Signature
 *
 * The canonical declaration of NonDeprecatedSchemaType<T>: derives the
 * TypeScript object type for a schema literal with all properties
 * marked `deprecated: true` omitted. Delegates to InferSchemaType<T>
 * and applies `Omit<…, DeprecatedKeysType<T>>`.
 */

import type { NonDeprecatedSchemaType } from '../../../src/types/index.js';

// Type declaration mirrors the canonical export in src/types/Infer.ts:
//
// export type NonDeprecatedSchemaType<T, TRoot = T, TReferences = Record<never, never>>
//   = T extends { readonly 'properties': unknown; readonly 'type': 'object' }
//     ? SimplifyType<Omit<InferSchemaType<T, TRoot, TReferences>, DeprecatedKeysType<T>>>
//     : InferSchemaType<T, TRoot, TReferences>;

const _BookV1Schema = {
  '$id': 'https://bookstore.example/BookV1',
  'properties': {
    'isbn': { 'type': 'string' },
    'legacySku': {
      'deprecated': true,
      'type': 'string'
    },
    'title': { 'type': 'string' }
  },
  'required': [
    'isbn',
    'title'
  ],
  'type': 'object'
} as const;

// legacySku is omitted from the inferred object shape.
type BookView = NonDeprecatedSchemaType<typeof _BookV1Schema>;

const view: BookView = {
  'isbn': '9783522128001',
  'title': 'Die unendliche Geschichte'
};

console.assert(view.isbn === '9783522128001');
console.assert(!('legacySku' in view));

console.log('BookView (NonDeprecatedSchemaType) keys:', Object.keys(view).join(', '));
console.log('isbn:', view.isbn, '| legacySku present:', 'legacySku' in view);
