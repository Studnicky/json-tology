/**
 * Compile-time identity assertions for `x-jt-predicate` annotations.
 *
 * The `x-jt-predicate` annotation binds a property to a specific RDF predicate
 * IRI for ontology/ABox projection. It is a *semantic* annotation only — it must
 * never change the TypeScript type a schema infers. Storage and validation see
 * the same value whether or not the predicate binding is present.
 *
 * These assertions prove `InferType` of a schema with `x-jt-predicate` on a
 * property is identical to `InferType` of the same schema without it, for both a
 * single annotated property and a whole-object schema.
 *
 * All scenarios are compile-time only — no runtime assertions.
 */

import type { InferType } from '../../src/types/Schema.js';

// ---------------------------------------------------------------------------
// Bidirectional equality helper
// ---------------------------------------------------------------------------

type AssertEqualType<TLeft, TRight>
  = [TLeft] extends [TRight] ? [TRight] extends [TLeft] ? true : false : false;

function assert<T extends true>(): void {
  void 0 as unknown as T;
}

// ---------------------------------------------------------------------------
// 1. Single property — annotated vs plain
// ---------------------------------------------------------------------------

const PlainTitleSchema = {
  '$id': 'https://bookstore.example/PlainTitle',
  'properties': { 'title': { 'type': 'string' } },
  'required': ['title'],
  'type': 'object'
} as const;

const AnnotatedTitleSchema = {
  '$id': 'https://bookstore.example/AnnotatedTitle',
  'properties': {
    'title': {
      'type': 'string',
      'x-jt-predicate': 'https://bookstore.example/title'
    }
  },
  'required': ['title'],
  'type': 'object'
} as const;

type PlainTitle = InferType<typeof PlainTitleSchema>;
type AnnotatedTitle = InferType<typeof AnnotatedTitleSchema>;

void PlainTitleSchema;
void AnnotatedTitleSchema;

// The predicate annotation does not alter the inferred type.
assert<AssertEqualType<AnnotatedTitle, PlainTitle>>();

// The property type itself is byte-for-byte identical.
assert<AssertEqualType<AnnotatedTitle['title'], PlainTitle['title']>>();
assert<AssertEqualType<AnnotatedTitle['title'], string>>();

// ---------------------------------------------------------------------------
// 2. Multi-property object — only one field annotated
// ---------------------------------------------------------------------------

const PlainBookSchema = {
  '$id': 'https://bookstore.example/PlainBook',
  'properties': {
    'pageCount': { 'type': 'integer' },
    'title': { 'type': 'string' }
  },
  'required': [
    'title',
    'pageCount'
  ],
  'type': 'object'
} as const;

const AnnotatedBookSchema = {
  '$id': 'https://bookstore.example/AnnotatedBook',
  'properties': {
    'pageCount': { 'type': 'integer' },
    'title': {
      'type': 'string',
      'x-jt-predicate': 'https://bookstore.example/title'
    }
  },
  'required': [
    'title',
    'pageCount'
  ],
  'type': 'object'
} as const;

type PlainBook = InferType<typeof PlainBookSchema>;
type AnnotatedBook = InferType<typeof AnnotatedBookSchema>;

void PlainBookSchema;
void AnnotatedBookSchema;

// Annotating one property leaves the whole inferred object type unchanged.
assert<AssertEqualType<AnnotatedBook, PlainBook>>();
assert<AssertEqualType<AnnotatedBook['title'], PlainBook['title']>>();
assert<AssertEqualType<AnnotatedBook['pageCount'], PlainBook['pageCount']>>();
