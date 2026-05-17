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

const BookV1Schema = {
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

type BookV1Full = InferType<typeof BookV1Schema>;
// { readonly isbn: string; readonly title: string; readonly legacySku?: string }

type BookV1Current = NonDeprecatedSchemaType<typeof BookV1Schema>;
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
