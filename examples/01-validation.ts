/**
 * 01-validation — Basic schema validation
 *
 * Demonstrates: registering schemas and validating data against them.
 * Shows validate() for error collection, is() as a type guard, and
 * errors() for structured error details.
 *
 * Run: npm run build && npx tsx examples/01-validation.ts
 */

import { JsonTology } from '../src/index.js';

// ---------------------------------------------------------------------------
// Schema definition
// ---------------------------------------------------------------------------

const BookSchema = {
  '$id': 'https://bookstore.example/schema/Book',
  'properties': {
    'isbn': {
      'minLength': 10,
      'type': 'string'
    },
    'price': {
      'minimum': 0,
      'type': 'number'
    },
    'title': { 'type': 'string' }
  },
  'required': [
    'title',
    'isbn'
  ],
  'type': 'object'
} as const;

// ---------------------------------------------------------------------------
// Create instance and register
// ---------------------------------------------------------------------------

// enableStrictGraph: false — this is a self-contained demo whose schema keeps
// constrained primitives (minimum, minLength) inline for brevity. The strict-graph
// default would require extracting each into its own $ref'd schema.
const jt = JsonTology.create({
  'baseIri': 'https://bookstore.example',
  'enableStrictGraph': false,
  'schemas': [BookSchema]
});

// ---------------------------------------------------------------------------
// 1. Valid data
// ---------------------------------------------------------------------------

const validBook = {
  'isbn': '978-3-16-148410-0',
  'price': 24.99,
  'title': 'The Neverending Story'
};
const validErrors = jt.validate(BookSchema.$id, validBook);

console.log('--- Valid data ---');
console.log('Input:', JSON.stringify(validBook));
console.log('Errors:', validErrors);
console.log();

// ---------------------------------------------------------------------------
// 2. Invalid data — missing required field, negative price
// ---------------------------------------------------------------------------

const invalidBook = { 'price': -5 };
const invalidErrors = jt.validate(BookSchema.$id, invalidBook);

console.log('--- Invalid data (missing required, negative price) ---');
console.log('Input:', JSON.stringify(invalidBook));
console.log('Errors:');
for (const msg of invalidErrors) {
  console.log(' ', msg);
}
console.log();

// ---------------------------------------------------------------------------
// 3. Wrong type
// ---------------------------------------------------------------------------

const wrongType = {
  'isbn': 9_780_316_148_410,
  'price': 'free',
  'title': 42
};
const wrongTypeErrors = jt.validate(BookSchema.$id, wrongType);

console.log('--- Wrong types ---');
console.log('Input:', JSON.stringify(wrongType));
console.log('Errors:');
for (const msg of wrongTypeErrors) {
  console.log(' ', msg);
}
console.log();

// ---------------------------------------------------------------------------
// 4. Type guard with is()
// ---------------------------------------------------------------------------

console.log('--- Type guard: is() ---');
console.log('is(valid):', jt.is(BookSchema.$id, validBook));
console.log('is(invalid):', jt.is(BookSchema.$id, invalidBook));
