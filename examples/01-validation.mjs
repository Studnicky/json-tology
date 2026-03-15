/**
 * 01-validation.mjs — Basic schema validation
 *
 * Demonstrates: registering schemas and validating data against them.
 * Shows validate() for error collection, is() as a type guard, and
 * errors() for structured error details.
 *
 * Run: npm run build && node examples/01-validation.mjs
 */

import { JsonTology } from '../dist/index.js';

// ---------------------------------------------------------------------------
// Schema definition
// ---------------------------------------------------------------------------

const UserSchema = {
  $id: 'https://example.com/User',
  type: 'object',
  properties: {
    name:  { type: 'string' },
    email: { type: 'string', format: 'email' },
    age:   { type: 'integer', minimum: 0 },
  },
  required: ['name', 'email'],
};

// ---------------------------------------------------------------------------
// Create instance and register
// ---------------------------------------------------------------------------

const jt = JsonTology.create({
  baseIRI: 'https://example.com',
  schemas: [UserSchema],
});

// ---------------------------------------------------------------------------
// 1. Valid data
// ---------------------------------------------------------------------------

const validUser = { name: 'Alice', email: 'alice@example.com', age: 30 };
const validErrors = jt.validate(UserSchema.$id, validUser);

console.log('--- Valid data ---');
console.log('Input:', JSON.stringify(validUser));
console.log('Errors:', validErrors);
console.log();

// ---------------------------------------------------------------------------
// 2. Invalid data — missing required field, wrong type, bad age
// ---------------------------------------------------------------------------

const invalidUser = { age: -5 };
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

const wrongType = { name: 42, email: 'not-an-email', age: 'old' };
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
