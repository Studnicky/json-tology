/**
 * Advanced Example 06 — enableStrictGraph mode
 * Demonstrates: strict graph checking is the default; consumers opt out to relax.
 *
 * Strict mode (the default, enableStrictGraph: true) rejects inline primitive
 * constraints such as { pattern: ..., type: 'string' } as properties — each
 * constrained primitive must be a named schema registered with a $id.
 *
 * Permissive mode (enableStrictGraph: false) accepts inline shapes silently;
 * use this only for test fixtures or migration scaffolding.
 */

import { SchemaRegistry } from '../../../src/modules/registry/SchemaRegistry.js';

const SchemaWithInlineShape = {
  '$id': 'urn:example:Book',
  'properties': {
    'isbn': {
      'pattern': '^\\d{13}$',
      'type': 'string'
    },
    'title': { 'type': 'string' }
  },
  'type': 'object'
} as const;

// Strict mode (default): inline shapes throw SchemaError
const strictRegistry = new SchemaRegistry();

try {
  strictRegistry.set(SchemaWithInlineShape);
  console.log('Strict mode: registration succeeded (unexpected)');
} catch (error) {
  const schemaErr = error as { 'code'?: string;
    'message'?: string };

  console.log(`Strict mode: registration threw [${schemaErr.code}]`);
  console.log('  Reason:', schemaErr.message?.split(':').slice(1)
    .join(':')
    .trim()
    .split(';')[0].trim());
}

// Permissive mode (opt-out): inline shapes register silently
const permissiveRegistry = new SchemaRegistry({ 'enableStrictGraph': false });

permissiveRegistry.set(SchemaWithInlineShape);
console.log('Permissive mode: registration succeeded (inline shapes are accepted)');
