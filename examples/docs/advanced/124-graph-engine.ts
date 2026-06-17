/**
 * Compiled validation — validate, check, errors, custom keywords.
 *
 * `SchemaRegistry` provides compiled closure-based validation for registered
 * JSON Schema graphs. Register schemas once and reuse the validator across calls.
 *
 * Demonstrated here:
 *   - `registry.validator(id).validate(value)` — returns `{ valid, errors, value }`
 *   - `registry.validator(id).check(value)` — fast boolean shortcut
 *   - `registry.validator(id).validate(value, { collectErrors: true })` — full error collection
 *   - custom keyword registration via `RegistryOptionsType.keywords`
 */

import type { KeywordContextType } from '../../../src/types/GraphEngine.js';
import { SchemaRegistry } from '../../../src/modules/registry/SchemaRegistry.js';

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

// Register once — the registry compiles the schema graph on first validate call.
const registry = new SchemaRegistry({ 'enableStrictGraph': false });

registry.set(BookSchema);

const validator = registry.validator(BookSchema.$id);

// ── validate — valid data ─────────────────────────────────────────────────────

const validResult = validator.validate({
  'pages': 396,
  'title': 'The Neverending Story'
}, { 'collectErrors': true });

console.assert(validResult.valid, 'valid book must pass validate()');
console.assert(validResult.errors.length === 0, 'valid book must have zero errors');
console.log('validate(valid) — valid:', validResult.valid, 'errors:', validResult.errors.length);

// ── validate — invalid data ────────────────────────────────────────────────────

const invalidResult = validator.validate({ 'pages': 0 }, { 'collectErrors': true });

console.assert(!invalidResult.valid, 'book missing title must fail validate()');
console.assert(
  invalidResult.errors.length > 0,
  'invalid result must carry at least one error'
);
console.log(
  `validate(invalid) — valid: ${String(invalidResult.valid)}`,
  `errors: ${invalidResult.errors.length}`,
  `first keyword: ${invalidResult.errors[0]?.keyword}`
);

// ── check — fast boolean shortcut ────────────────────────────────────────────

const checkValid = validator.check({ 'title': 'Dune' });
const checkInvalid = validator.check({});

console.assert(checkValid, 'check() must return true for valid data');
console.assert(!checkInvalid, 'check() must return false for missing required field');
console.log('check(valid):', checkValid, '  check(invalid):', checkInvalid);

// ── full error collection ─────────────────────────────────────────────────────

const errorResult = validator.validate({ 'pages': -1 }, { 'collectErrors': true });

console.assert(Array.isArray(errorResult.errors), 'errors must be an array');
console.assert(errorResult.errors.length > 0, 'must report at least one error for invalid data');
console.log('errors for { pages: -1 }:', errorResult.errors.length);

// ── custom keyword registration ───────────────────────────────────────────────

// Custom keywords are registered at the registry level and apply to all
// compiled validators created by that registry.
const customRegistry = new SchemaRegistry({
  'enableStrictGraph': false,
  'keywords': [{
    'keyword': 'x-example-tag',
    'type': 'string',
    'validate': (_schema: unknown, _data: unknown, _ctx: KeywordContextType): boolean => {
      return true;
    }
  }]
});

customRegistry.set(BookSchema);

const customResult = customRegistry.validator(BookSchema.$id).validate({ 'title': 'Dune' });

console.assert(customResult.valid, 'custom registry must validate correctly');
console.log('custom registry validate(valid).valid:', customResult.valid);
