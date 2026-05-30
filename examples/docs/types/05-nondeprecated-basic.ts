/**
 * NonDeprecatedSchemaType — Example 1: Schema with a deprecated field
 *
 * Demonstrates the difference between InferType (includes all props)
 * and NonDeprecatedSchemaType (omits deprecated props).
 */

import type {
  InferType, NonDeprecatedSchemaType
} from '../../../src/types/index.js';

type AssertEqualType<TLeft, TRight>
  = [TLeft] extends [TRight] ? [TRight] extends [TLeft] ? true : false : false;

function assert<T extends true>(): void {
  void 0 as unknown as T;
}

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

type BookV1Full = InferType<typeof _BookV1Schema>;
// { readonly isbn: string; readonly title: string; readonly legacySku?: string }

type BookV1Current = NonDeprecatedSchemaType<typeof _BookV1Schema>;
// { readonly isbn: string; readonly title: string }
//  - legacySku is gone

assert<AssertEqualType<
  BookV1Full['legacySku'] extends string | undefined ? true : false,
  true
>>();

assert<AssertEqualType<
  'legacySku' extends keyof BookV1Current ? true : false,
  false
>>();

void (null as unknown as BookV1Current | BookV1Full);

// Runtime demonstration: the filtered type omits legacySku.
const bookCurrent: BookV1Current = {
  'isbn': '9783522128001',
  'title': 'Die unendliche Geschichte'
};
const bookFull: BookV1Full = {
  'isbn': '9783522128001',
  'legacySku': 'OLD-NES-001',
  'title': 'Die unendliche Geschichte'
};

console.log('InferType (full) keys:', Object.keys(bookFull).join(', '));
console.log('NonDeprecatedSchemaType keys:', Object.keys(bookCurrent).join(', '), '(legacySku omitted)');
