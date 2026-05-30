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

const UserSchema = {
  '$id': 'https://example.com/User',
  'properties': {
    'age': {
      'minimum': 0,
      'type': 'integer'
    },
    'email': {
      'format': 'email',
      'type': 'string'
    },
    'name': { 'type': 'string' }
  },
  'required': [
    'name',
    'email'
  ],
  'type': 'object'
} as const;

// ---------------------------------------------------------------------------
// Create instance and register
// ---------------------------------------------------------------------------

// enableStrictGraph: false — this is a self-contained demo whose schema keeps
// constrained primitives (minimum, format) inline for brevity. The strict-graph
// default would require extracting each into its own $ref'd schema.
const jt = JsonTology.create({
  'baseIRI': 'https://example.com',
  'enableStrictGraph': false,
  'schemas': [UserSchema]
});

// ---------------------------------------------------------------------------
// 1. Valid data
// ---------------------------------------------------------------------------

const validUser = {
  'age': 30,
  'email': 'alice@example.com',
  'name': 'Alice'
};
const validErrors = jt.validate(UserSchema.$id, validUser);

console.log('--- Valid data ---');
console.log('Input:', JSON.stringify(validUser));
console.log('Errors:', validErrors);
console.log();

// ---------------------------------------------------------------------------
// 2. Invalid data — missing required field, wrong type, bad age
// ---------------------------------------------------------------------------

const invalidUser = { 'age': -5 };
const invalidErrors = jt.validate(UserSchema.$id, invalidUser);

console.log('--- Invalid data (missing required, negative age) ---');
console.log('Input:', JSON.stringify(invalidUser));
console.log('Errors:');
for (const msg of invalidErrors) {
  console.log(' ', msg);
}
console.log();

// ---------------------------------------------------------------------------
// 3. Wrong type
// ---------------------------------------------------------------------------

const wrongType = {
  'age': 'old',
  'email': 'not-an-email',
  'name': 42
};
const wrongTypeErrors = jt.validate(UserSchema.$id, wrongType);

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
console.log('is(valid):', jt.is(UserSchema.$id, validUser));
console.log('is(invalid):', jt.is(UserSchema.$id, invalidUser));
