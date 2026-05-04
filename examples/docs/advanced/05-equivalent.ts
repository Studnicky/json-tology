/**
 * Advanced Example 05 — Compose.equivalent()
 * Demonstrates: domain-distinct name aliases with OWL equivalentClass semantics
 */

import { Compose } from '../../../src/modules/composition/Compose.js';
import { SchemaRegistry } from '../../../src/modules/registry/SchemaRegistry.js';

const IsbnSchema = {
  '$id': 'urn:bookstore:Isbn',
  'description': 'International Standard Book Number (13-digit)',
  'pattern': '^\\d{13}$',
  'type': 'string'
} as const;

const PrimaryIsbnSchema = Compose.equivalent(IsbnSchema, {
  '$id': 'urn:bookstore:PrimaryIsbn',
  'description': 'The primary ISBN used for catalog lookup and ordering'
});

const registry = new SchemaRegistry();

registry.register(IsbnSchema as unknown as Record<string, unknown>);
registry.register(PrimaryIsbnSchema as unknown as Record<string, unknown>);

// Both schemas validate the same data
const validIsbn = '9780306406157';
const invalidIsbn = 'not-an-isbn';

console.log('Validating against IsbnSchema:');
console.log('  valid:', registry.validate(IsbnSchema.$id, validIsbn));
console.log('  invalid:', registry.validate(IsbnSchema.$id, invalidIsbn).items.slice(0, 1).map((errItem) => {
  return errItem.message;
}));

console.log('Validating against PrimaryIsbnSchema:');
console.log('  valid:', registry.validate(PrimaryIsbnSchema.$id, validIsbn));
console.log('  invalid:', registry.validate(PrimaryIsbnSchema.$id, invalidIsbn).items.slice(0, 1).map((errItem) => {
  return errItem.message;
}));

// PrimaryIsbn output shape: thin $ref alias
console.log('\nPrimaryIsbnSchema shape:', JSON.stringify(PrimaryIsbnSchema, null, 2));
