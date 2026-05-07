/**
 * Advanced Example 06 — enableStrictGraph mode
 * Demonstrates: how the same schema succeeds silently but throws in strict mode
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

// Default mode: inline shapes register silently
const defaultRegistry = new SchemaRegistry();

defaultRegistry.register(SchemaWithInlineShape);
console.log('Default mode: registration succeeded (inline shapes are silent)');

// Strict mode: inline shapes throw SchemaError
const strictRegistry = new SchemaRegistry({ 'enableStrictGraph': true });

try {
  strictRegistry.register(SchemaWithInlineShape);
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
