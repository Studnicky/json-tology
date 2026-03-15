/**
 * 02-parse-and-materialize.mjs — Parsing with defaults, materialization
 *
 * Demonstrates: parse (validate + apply defaults), materialize (build from partial).
 * parse() throws on invalid data; materialize() fills in all schema defaults.
 *
 * Run: npm run build && node examples/02-parse-and-materialize.mjs
 */

import { JsonTology } from '../dist/index.js';

// ---------------------------------------------------------------------------
// Schema with defaults
// ---------------------------------------------------------------------------

const ConfigSchema = {
  '$id': 'https://example.com/Config',
  'properties': {
    'debug': {
      'default': false,
      'type': 'boolean'
    },
    'locale': {
      'default': 'en',
      'type': 'string'
    },
    'pageSize': {
      'default': 25,
      'type': 'integer'
    },
    'theme': {
      'default': 'light',
      'type': 'string'
    }
  },
  'required': [],
  'type': 'object'
};

const jt = JsonTology.create({
  'baseIRI': 'https://example.com',
  'schemas': [ConfigSchema]
});

// ---------------------------------------------------------------------------
// 1. Parse incoming data — missing fields get defaults
// ---------------------------------------------------------------------------

const incoming = { 'theme': 'dark' };
const parsed = jt.parse(ConfigSchema, incoming);

console.log('--- Parse with defaults ---');
console.log('Input:', JSON.stringify(incoming));
console.log('Parsed:', JSON.stringify(parsed, null, 2));
console.log();

// ---------------------------------------------------------------------------
// 2. Parse invalid data — throws ParseError
// ---------------------------------------------------------------------------

console.log('--- Parse invalid data ---');
try {
  jt.parse(ConfigSchema, { 'pageSize': 'many' });
} catch (err) {
  console.log('Caught error:', err.message);
}
console.log();

// ---------------------------------------------------------------------------
// 3. Materialize from empty — full object with all defaults
// ---------------------------------------------------------------------------

const fromEmpty = jt.materialize(ConfigSchema);

console.log('--- Materialize from empty ---');
console.log('Result:', JSON.stringify(fromEmpty, null, 2));
console.log();

// ---------------------------------------------------------------------------
// 4. Materialize from partial — merge provided values with defaults
// ---------------------------------------------------------------------------

const fromPartial = jt.materialize(ConfigSchema, {
  'debug': true,
  'locale': 'fr'
});

console.log('--- Materialize from partial ---');
console.log('Input:', JSON.stringify({
  'debug': true,
  'locale': 'fr'
}));
console.log('Result:', JSON.stringify(fromPartial, null, 2));
