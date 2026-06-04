/**
 * GraphEngine — execute, check, errors, keywords, rootSchemaId.
 *
 * `GraphEngine` is the core validation and execution engine for compiled
 * JSON Schema graphs. Instantiate once per root schema and reuse across calls.
 *
 * Demonstrated here:
 *   - `execute(value)` — returns `{ valid, errors, value, … }`
 *   - `check(value)` — fast boolean shortcut (no error collection)
 *   - `errors(value)` — returns only the `ValidationErrorType[]`
 *   - `keywords()` — returns any registered custom keyword definitions
 *   - `rootSchemaId()` — returns the `$id` of the root schema (or undefined)
 */

import type { KeywordContextInterface } from '../../../src/interfaces/GraphEngine.js';
import { GraphEngine } from '../../../src/index.js';

// ── Schema under test ────────────────────────────────────────────────────────

const BookSchema = {
  '$id': 'https://bookstore.example/Book',
  'properties': {
    'pages': {
      'minimum': 1,
      'type': 'integer'
    },
    'title': { 'type': 'string' }
  },
  'required': ['title'],
  'type': 'object'
} as const;

// Instantiate once — the engine caches the compiled graph internally.
const engine = new GraphEngine(BookSchema);

// ── rootSchemaId ─────────────────────────────────────────────────────────────

const schemaId = engine.rootSchemaId();

console.assert(
  schemaId === 'https://bookstore.example/Book',
  `rootSchemaId() must return the schema $id; got: ${schemaId}`
);
console.log('rootSchemaId():', schemaId);

// ── execute — valid data ─────────────────────────────────────────────────────

const validResult = engine.execute({
  'pages': 396,
  'title': 'The Neverending Story'
});

console.assert(validResult.valid, 'valid book must pass execute()');
console.assert(validResult.errors.length === 0, 'valid book must have zero errors');
console.log('execute(valid) — valid:', validResult.valid, 'errors:', validResult.errors.length);

// ── execute — invalid data ────────────────────────────────────────────────────

const invalidResult = engine.execute({ 'pages': 0 });

console.assert(!invalidResult.valid, 'book missing title must fail execute()');
console.assert(
  invalidResult.errors.length > 0,
  'invalid result must carry at least one error'
);
console.log(
  `execute(invalid) — valid: ${String(invalidResult.valid)}`,
  `errors: ${invalidResult.errors.length}`,
  `first keyword: ${invalidResult.errors[0]?.keyword}`
);

// ── check — fast boolean ─────────────────────────────────────────────────────

const checkValid = engine.check({ 'title': 'Dune' });
const checkInvalid = engine.check({});

console.assert(checkValid, 'check() must return true for valid data');
console.assert(!checkInvalid, 'check() must return false for missing required field');
console.log('check(valid):', checkValid, '  check(invalid):', checkInvalid);

// ── errors — error array shortcut ────────────────────────────────────────────

const errs = engine.errors({ 'pages': -1 });

console.assert(Array.isArray(errs), 'errors() must return an array');
console.assert(errs.length > 0, 'errors() must report at least one error for invalid data');
console.log('errors() count for { pages: -1 }:', errs.length);

// ── keywords — custom keyword definitions ─────────────────────────────────────

// When no custom keywords are registered, keywords() returns an empty array.
const kws = engine.keywords();

console.assert(Array.isArray(kws), 'keywords() must return an array');
console.log('keywords() length (no custom keywords):', kws.length);

// With a custom keyword registered:
const customEngine = new GraphEngine(BookSchema, {
  'keywords': [{
    'keyword': 'x-example-tag',
    'type': 'string',
    'validate': (_schema: unknown, _data: unknown, _ctx: KeywordContextInterface): boolean => {
      return true;
    }
  }]
});

const customKws = customEngine.keywords();

console.assert(customKws.length === 1, 'custom engine must have 1 keyword definition');
console.assert(customKws[0]?.keyword === 'x-example-tag', 'keyword name must match');
console.log('custom keywords():', customKws.map((kw) => {
  return kw.keyword;
}).join(', '));
