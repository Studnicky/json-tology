/**
 * e2e-validation.ts — Runtime validation pipeline
 *
 * Demonstrates validate, errors, parse, value operations,
 * transforms, sub-schema validation, and custom formats —
 * all against the shared FOAF domain.
 *
 * Run: npm run build && tsx examples/e2e-validation.ts
 */

import {
  InstantiationError, JsonTology, Value
} from '../dist/index.js';
import {
  allSchemas, DateTimeSchema, foafPersons,
  PersonSchema
} from '../test/fixtures/foaf.js';

// ---------------------------------------------------------------------------
// Create instance with coercion
// ---------------------------------------------------------------------------

const jt = JsonTology.create({
  'baseIRI': 'http://xmlns.com/foaf',
  'enableTypeCast': true,
  'schemas': allSchemas
});

// ===== 1. validate() — quick error strings ================================

console.log('=== 1. validate() — ValidationErrors ===');
const good = jt.validate(PersonSchema.$id, foafPersons[0]);

console.log('Valid person (ok):', good.ok);

const bad = {
  'familyName': 42,
  'givenName': '',
  'mbox': 'not-email'
};
const badErrors = jt.validate(PersonSchema.$id, bad);

console.log('Invalid person errors:');
for (const errItem of badErrors) {
  console.log(' ', errItem.path, ':', errItem.message);
}

// ===== 2. errors() — structured ValidationErrors ==========================

console.log('\n=== 2. validate() — structured items ===');
const errs = jt.validate(PersonSchema.$id, bad);

console.log('Count:', errs.length);
for (const err of errs) {
  console.log(' ', err.path || 'root', ':', err.message);
}

// ===== 3. coerce() — validate + defaults + strip unknowns ==================

console.log('\n=== 3. coerce() ===');
const parsed = jt.instantiate(PersonSchema.$id, {
  ...foafPersons[0],
  // unknown property — stripped by coerce
  '_csrf': 'token123'
});

console.log('Parsed person:', JSON.stringify(parsed, null, 2));

console.log('\nCatching InstantiationError:');
try {
  jt.instantiate(PersonSchema.$id, bad);
} catch (error) {
  if (error instanceof InstantiationError) {
    console.log('  code:', error.code);
    console.log('  message:', error.message);
  }
}

// ===== 4. value.cast() — coerce types =====================================

console.log('\n=== 4. value.cast() ===');
const coerced = jt.value.cast(PersonSchema.$id, {
  // string → number coercion
  'age': '28',
  'familyName': 'Lin',
  'givenName': 'Dave',
  'mbox': 'dave@example.org'
});

console.log('Coerced age:', JSON.stringify(coerced));

// ===== 5. value.clean() — strip unknown properties ========================

console.log('\n=== 5. value.clean() ===');
const cleaned = jt.value.clean(PersonSchema.$id, {
  ...foafPersons[0],
  '_internal': true,
  'debugFlag': 'yes'
});

console.log('Cleaned:', JSON.stringify(cleaned));

// ===== 6. value.create() — synthesize default instance ====================

console.log('\n=== 6. value.create() ===');
const defaults = jt.value.create(PersonSchema.$id);

console.log('Default person:', JSON.stringify(defaults, null, 2));

// ===== 7. Value.diff() — detect changes ===================================

console.log('\n=== 7. Value.diff() ===');
const before = foafPersons[0];
const after = {
  ...before,
  'familyName': 'Smith-Park',
  'knows': [
    'bob',
    'carol',
    'dave'
  ]
};

const diff = Value.diff(before, after);

console.log('Changes:', diff.length, '— isEmpty:', diff.isEmpty);
for (const op of diff.operations) {
  console.log(` ${op.op} ${op.path}`, 'value' in op ? `→ ${JSON.stringify(op.value)}` : '');
}
// eslint-disable-next-line no-restricted-syntax -- Changeset#apply, not Function.prototype.apply
const applied = diff.apply(before);

console.log('Applied matches after:', JSON.stringify(applied) === JSON.stringify(after));

// ===== 8. Value.hash() — content-addressed deduplication ===================

console.log('\n=== 8. Value.hash() ===');
const h1 = Value.hash({
  'familyName': 'Smith',
  'givenName': 'Alice'
});
// same content, different variable — should produce identical hash
const h2 = Value.hash({
  'familyName': 'Smith',
  'givenName': 'Alice'
});

console.log('hash({givenName,familyName}):', h1);
console.log('hash({familyName,givenName}):', h2);
console.log('Equal:', h1 === h2);

// ===== 9. Transform roundtrip =============================================

console.log('\n=== 9. Transform roundtrip ===');
const date = jt.instantiate(DateTimeSchema.$id, '2026-03-15T10:30:00.000Z') as unknown;

if (date instanceof Date) {
  console.log('Decoded:', date.constructor.name, date.toISOString());
} else {
  console.log('Decoded:', typeof date);
}
const wire = jt.encode(DateTimeSchema, date);

console.log('Encoded:', wire);

// ===== 10. subschemaAt() — resolve nested sub-schema ======================

console.log('\n=== 10. subschemaAt() ===');
const knowsSub = jt.subschemaAt(PersonSchema.$id, '/properties/knows');

const knowsOkErrs = jt.validate(knowsSub, [
  'alice',
  'bob'
]);

console.log('Valid knows at pointer errors:', knowsOkErrs.items.length);

const knowsBadErrs = jt.validate(knowsSub, 'not-an-array');

console.log('Invalid knows at pointer:');
for (const err of knowsBadErrs.items) {
  console.log(' ', err.path || 'root', ':', err.message);
}
