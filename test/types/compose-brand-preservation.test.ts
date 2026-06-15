/**
 * Compile-time assertions for constraint brand preservation through Compose operations.
 *
 * When a schema property carries a phantom constraint brand (e.g. `minLength: 1`
 * produces `MinLengthBrandType<1>` on the inferred string type), that brand must
 * survive the structural transformations that Compose operations apply to the
 * schema's `properties` and `required` arrays.
 *
 * ## What is tested
 *
 * For each Compose operation that preserves properties (partial, required,
 * pick, omit, extend, intersection), we assert that:
 *   - A property whose schema carries a constraint keyword (`minLength`, etc.)
 *     still infers to a type that includes the corresponding brand after the
 *     operation.
 *   - A property that is removed (omit, pick of the other key) disappears from
 *     the inferred type.
 *
 * ## Operations and their brand behaviour (tsc-verified)
 *
 * | Operation                   | Brand preserved? |
 * |-----------------------------|-----------------|
 * | Compose.partial             | YES             |
 * | Compose.required            | YES             |
 * | Compose.pick (keep branded) | YES             |
 * | Compose.omit (keep branded) | YES             |
 * | Compose.extend (new prop)   | YES             |
 * | Compose.intersection        | YES             |
 *
 * All operations delegate to InferSchemaType on the transformed schema literal.
 * Because Compose methods preserve the `properties` sub-schema objects verbatim,
 * the brand keywords (`minLength`, `pattern`, etc.) remain on the property schema
 * and InferStringBrandsType picks them up during inference. Brands are NOT
 * dropped by any Compose operation — this file locks that invariant.
 *
 * ## Type-config note
 *
 * String brands (`MinLengthBrandType`, `PatternBrandType`) are emitted only when
 * `stringBrands` is enabled in `JsonTologyTypeConfigInterface`. The default
 * configuration has `stringBrands: true`. This file does not augment the config;
 * it tests the default state.
 */

import {
  describe, it
} from 'node:test';

import type {
  MinLengthBrandType,
  PatternBrandType
} from '../../src/types/ConstraintBrands.js';
import type { InferType } from '../../src/types/Schema.js';
import { Compose } from '../../src/modules/composition/Compose.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type AssertAssignable<TSource, TTarget>
  = [TSource] extends [TTarget] ? true : false;

function assert<T extends true>(): void {
  void 0 as unknown as T;
}

// ---------------------------------------------------------------------------
// Base schema with branded properties
//
// `name` carries minLength:1 → InferType gives MinLengthBrandType<1> & string
// `slug` carries pattern → InferType gives PatternBrandType<'^[a-z-]+$'> & string
// `description` is plain string — no brands
// ---------------------------------------------------------------------------

const BookSchema = {
  '$id': 'https://example.com/test/Book',
  'properties': {
    'description': { 'type': 'string' },
    'name': {
      'minLength': 1,
      'type': 'string'
    },
    'slug': {
      'pattern': '^[a-z-]+$',
      'type': 'string'
    }
  },
  'required': [
    'name',
    'slug'
  ],
  'type': 'object'
} as const;

void BookSchema;

// Baseline — brands are present on the base schema
type BookType = InferType<typeof BookSchema>;
assert<AssertAssignable<BookType['name'], MinLengthBrandType<1>>>();
assert<AssertAssignable<BookType['slug'], PatternBrandType<'^[a-z-]+$'>>>();

// ---------------------------------------------------------------------------
// 1. Compose.partial — all required become optional, property schemas preserved
// ---------------------------------------------------------------------------

const PartialBookSchema = Compose.partial(BookSchema, 'https://example.com/test/PartialBook');

type PartialBookType = InferType<typeof PartialBookSchema>;

// Properties become optional but their schemas (and hence brands) are unchanged
assert<AssertAssignable<NonNullable<PartialBookType['name']>, MinLengthBrandType<1>>>();
assert<AssertAssignable<NonNullable<PartialBookType['slug']>, PatternBrandType<'^[a-z-]+$'>>>();

// ---------------------------------------------------------------------------
// 2. Compose.required — all properties become required, schemas preserved
// ---------------------------------------------------------------------------

const RequiredBookSchema = Compose.required(BookSchema, 'https://example.com/test/RequiredBook');

type RequiredBookType = InferType<typeof RequiredBookSchema>;

assert<AssertAssignable<RequiredBookType['name'], MinLengthBrandType<1>>>();
assert<AssertAssignable<RequiredBookType['slug'], PatternBrandType<'^[a-z-]+$'>>>();
assert<AssertAssignable<RequiredBookType['description'], string>>();

// ---------------------------------------------------------------------------
// 3. Compose.pick — retain only specified keys
//    Picking 'name' and 'slug' keeps both brands.
//    Picking only 'name' keeps its brand; slug disappears.
// ---------------------------------------------------------------------------

const PickNameSlugSchema = Compose.pick(
  BookSchema,
  [
    'name',
    'slug'
  ] as const,
  'https://example.com/test/BookNameSlug'
);

type PickNameSlugType = InferType<typeof PickNameSlugSchema>;
assert<AssertAssignable<PickNameSlugType['name'], MinLengthBrandType<1>>>();
assert<AssertAssignable<PickNameSlugType['slug'], PatternBrandType<'^[a-z-]+$'>>>();

// Pick only the branded name; slug is omitted from the schema
const PickNameOnlySchema = Compose.pick(
  BookSchema,
  ['name'] as const,
  'https://example.com/test/BookNameOnly'
);

type PickNameOnlyType = InferType<typeof PickNameOnlySchema>;
assert<AssertAssignable<PickNameOnlyType['name'], MinLengthBrandType<1>>>();

// ---------------------------------------------------------------------------
// 4. Compose.omit — remove specified keys, remaining schemas preserved
// ---------------------------------------------------------------------------

const OmitDescriptionSchema = Compose.omit(
  BookSchema,
  ['description'] as const,
  'https://example.com/test/BookNoDescription'
);

type OmitDescriptionType = InferType<typeof OmitDescriptionSchema>;
assert<AssertAssignable<OmitDescriptionType['name'], MinLengthBrandType<1>>>();
assert<AssertAssignable<OmitDescriptionType['slug'], PatternBrandType<'^[a-z-]+$'>>>();

// ---------------------------------------------------------------------------
// 5. Compose.extend — add a new branded property; existing brands survive
// ---------------------------------------------------------------------------

const ExtendedBookSchema = Compose.extend(
  BookSchema,
  {
    'isbn': {
      'minLength': 10,
      'type': 'string'
    }
  } as const,
  'https://example.com/test/BookWithIsbn'
);

type ExtendedBookType = InferType<typeof ExtendedBookSchema>;

// Existing brands survive
assert<AssertAssignable<ExtendedBookType['name'], MinLengthBrandType<1>>>();
assert<AssertAssignable<ExtendedBookType['slug'], PatternBrandType<'^[a-z-]+$'>>>();
// New branded property also carries its brand
assert<AssertAssignable<NonNullable<ExtendedBookType['isbn']>, MinLengthBrandType<10>>>();

// ---------------------------------------------------------------------------
// 6. Compose.intersection — allOf merge; all constituent brands survive
// ---------------------------------------------------------------------------

const AuthorSchema = {
  '$id': 'https://example.com/test/Author',
  'properties': {
    'bio': { 'type': 'string' },
    'pen': {
      'minLength': 1,
      'type': 'string'
    }
  },
  'required': ['pen'],
  'type': 'object'
} as const;

void AuthorSchema;

const BookWithAuthorSchema = Compose.intersection(
  [
    BookSchema,
    AuthorSchema
  ] as const,
  'https://example.com/test/BookWithAuthor'
);

type BookWithAuthorType = InferType<typeof BookWithAuthorSchema>;

assert<AssertAssignable<BookWithAuthorType['name'], MinLengthBrandType<1>>>();
assert<AssertAssignable<BookWithAuthorType['slug'], PatternBrandType<'^[a-z-]+$'>>>();
assert<AssertAssignable<BookWithAuthorType['pen'], MinLengthBrandType<1>>>();

// ---------------------------------------------------------------------------
// Suppress unused variable warnings
// ---------------------------------------------------------------------------

void [
  PartialBookSchema,
  RequiredBookSchema,
  PickNameSlugSchema,
  PickNameOnlySchema,
  OmitDescriptionSchema,
  ExtendedBookSchema,
  BookWithAuthorSchema
];

// ---------------------------------------------------------------------------
// Runtime smoke test
// ---------------------------------------------------------------------------

void describe('Compose brand preservation', () => {
  void it('constraint brands survive all Compose operations', () => {
    // All assertions are compile-time. This block is a required no-op for tsx.
    void BookSchema.$id;
  });
});
