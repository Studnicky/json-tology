/**
 * NonDeprecatedSchemaType — Example: Using as a return type for a view
 * layer function.
 *
 * The view function accepts an already-validated book and returns the
 * object with deprecated fields stripped. The return type annotation
 * signals to callers that they should not depend on deprecated fields.
 */

import type {
  InferType, NonDeprecatedSchemaType
} from '../../../src/types/index.js';

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

type BookV1 = InferType<typeof _BookV1Schema>;
type BookV1View = NonDeprecatedSchemaType<typeof _BookV1Schema>;

function toBookView(book: BookV1): BookV1View {
  // Strip the deprecated property in the view layer. The return type
  // annotation prevents downstream code from depending on legacySku.
  const {
    'legacySku': _, ...rest
  } = book;

  return rest;
}

const stored: BookV1 = {
  'isbn': '9783522202008',
  'legacySku': 'OLD-NES-001',
  'title': 'Die unendliche Geschichte'
};

const view = toBookView(stored);

console.assert(view.isbn === stored.isbn);
console.assert(view.title === stored.title);
console.assert(!('legacySku' in view));
