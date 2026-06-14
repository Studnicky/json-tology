/**
 * 06-composition — Schema composition
 *
 * Demonstrates: extending, picking, and making schemas partial using
 * the Compose utility. Each derived schema is a valid JSON Schema
 * that can be registered and validated against.
 *
 * Run: npm run build && npx tsx examples/06-composition.ts
 */

import {
  Compose, JsonTology
} from '../src/index.js';

// ---------------------------------------------------------------------------
// Base schema
// ---------------------------------------------------------------------------

const BookSchema = {
  '$id': 'https://bookstore.example/schema/Book',
  'properties': {
    'addedAt': {
      'format': 'date-time',
      'type': 'string'
    },
    'isbn': { 'type': 'string' },
    'price': {
      'minimum': 0,
      'type': 'number'
    },
    'title': { 'type': 'string' }
  },
  'required': [
    'isbn',
    'title',
    'price'
  ],
  'type': 'object'
} as const;

// ---------------------------------------------------------------------------
// 1. Extend — add fields to create FeaturedBook
// ---------------------------------------------------------------------------

const FeaturedBookSchema = Compose.extend(
  BookSchema,
  {
    'featuredUntil': {
      'format': 'date-time',
      'type': 'string'
    },
    'placement': {
      'enum': [
        'homepage',
        'category-top',
        'editor-pick'
      ],
      'type': 'string'
    }
  },
  'https://bookstore.example/schema/FeaturedBook'
);

// Compose.extend composes via `allOf: [{ $ref: parent }, additions]` at runtime,
// so the merged property view lives in the inferred TS type rather than as a flat
// `properties` object on the value. Validation below proves the merge is in effect.
console.log('--- Compose.extend (FeaturedBook) ---');
console.log('$id:', FeaturedBookSchema.$id);
console.log();

// ---------------------------------------------------------------------------
// 2. Pick — select a subset of fields
// ---------------------------------------------------------------------------

const BookSummarySchema = Compose.pick(
  BookSchema,
  [
    'isbn',
    'title'
  ],
  'https://bookstore.example/schema/BookSummary'
);

console.log('--- Compose.pick (BookSummary) ---');
console.log('$id:', BookSummarySchema.$id);
console.log('Properties:', Object.keys(BookSummarySchema.properties).join(', '));
const summaryRequired = [...BookSummarySchema.required];

console.log('Required:', summaryRequired.length > 0 ? summaryRequired.join(', ') : '(none)');
console.log();

// ---------------------------------------------------------------------------
// 3. Partial — make all fields optional
// ---------------------------------------------------------------------------

const PatchBookSchema = Compose.partial(
  BookSchema,
  'https://bookstore.example/schema/PatchBook'
);

console.log('--- Compose.partial (PatchBook) ---');
console.log('$id:', PatchBookSchema.$id);
console.log('Properties:', Object.keys(PatchBookSchema.properties).join(', '));
// Compose.partial drops the `required` array entirely — every field is optional.
console.log('Required:', '(none — all optional)');
console.log();

// ---------------------------------------------------------------------------
// 4. Validate against each derived schema
// ---------------------------------------------------------------------------

// enableStrictGraph: false — self-contained demo with constrained primitives
// (format, enum, minimum) kept inline for brevity rather than extracted to $ref'd schemas.
const jt = JsonTology.create({
  'baseIRI': 'https://bookstore.example',
  'enableStrictGraph': false,
  'schemas': [BookSchema]
});

const jt2 = jt
  .set(FeaturedBookSchema)
  .set(BookSummarySchema)
  .set(PatchBookSchema);

const fullBook = {
  'addedAt': '2026-01-01T00:00:00Z',
  'isbn': '978-3-16-148410-0',
  'price': 24.99,
  'title': 'The Neverending Story'
};

const featuredBook = {
  ...fullBook,
  'featuredUntil': '2026-12-31T23:59:59Z',
  'placement': 'homepage'
};

console.log('--- Validation results ---');

const bookErrors = jt2.validate(BookSchema.$id, fullBook);

console.log('Book (valid):', bookErrors.length === 0 ? 'PASS' : bookErrors);

const featuredErrors = jt2.validate(FeaturedBookSchema.$id, featuredBook);

console.log('FeaturedBook (valid):', featuredErrors.length === 0 ? 'PASS' : featuredErrors);

const summaryErrors = jt2.validate(BookSummarySchema.$id, {
  'isbn': '978-3-16-148410-0',
  'title': 'The Neverending Story'
});

console.log('BookSummary (valid):', summaryErrors.length === 0 ? 'PASS' : summaryErrors);

const patchErrors = jt2.validate(PatchBookSchema.$id, { 'price': 19.99 });

console.log('PatchBook (partial):', patchErrors.length === 0 ? 'PASS' : patchErrors);

const badFeatured = {
  'isbn': '978-3-16-148410-0',
  'title': 'The Neverending Story'
};
const badFeaturedErrors = jt2.validate(FeaturedBookSchema.$id, badFeatured);

console.log('FeaturedBook (missing price):', badFeaturedErrors.length > 0 ? 'FAIL as expected' : 'unexpected pass');
