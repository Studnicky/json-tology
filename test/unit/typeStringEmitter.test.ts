/**
 * TypeStringEmitter — unit tests
 *
 * Verifies faithful TS type emission from real SchemaGraph instances.
 * Inline schemas, no external fixtures.
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { SchemaGraph } from '../../src/modules/graph/SchemaGraph.js';
import { TypeStringEmitter } from '../../src/modules/viz/TypeStringEmitter.js';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function emit(schema: Record<string, unknown>): string {
  const graph = new SchemaGraph(schema);

  return new TypeStringEmitter(graph).emit();
}

// ---------------------------------------------------------------------------
// Object with required + optional properties
// ---------------------------------------------------------------------------

void describe('TypeStringEmitter object shapes', () => {
  void it('required property uses colon; optional property uses ?:', () => {
    const result = emit({
      '$id': 'https://example.com/Book',
      'properties': {
        'author': { 'type': 'string' },
        'title': { 'type': 'string' }
      },
      'required': ['title'],
      'type': 'object'
    });

    // title is required
    assert.match(result, /title:\s*string/u, 'required prop should use colon separator');
    // author is optional
    assert.match(result, /author\?:\s*string/u, 'optional prop should use ?: separator');
  });

  void it('produces primitive types for string, number, boolean properties', () => {
    const result = emit({
      '$id': 'https://example.com/Product',
      'properties': {
        'active': { 'type': 'boolean' },
        'name': { 'type': 'string' },
        'price': { 'type': 'number' }
      },
      'required': [
        'name',
        'price',
        'active'
      ],
      'type': 'object'
    });

    assert.match(result, /name:\s*string/u);
    assert.match(result, /price:\s*number/u);
    assert.match(result, /active:\s*boolean/u);
  });

  void it('stub output "Record<string, unknown>" is absent for a structured object', () => {
    const result = emit({
      '$id': 'https://example.com/User',
      'properties': { 'id': { 'type': 'string' } },
      'required': ['id'],
      'type': 'object'
    });

    // The old placeholder emitted exactly "Record<string, unknown>" as the full body
    // A structured object with named properties should NOT produce that stub output
    assert.ok(
      !result.startsWith('type User = Record<string, unknown>;'),
      `stub output must be gone; got: ${result}`
    );
    // It should contain the declared property
    assert.match(result, /id:\s*string/u);
  });
});

// ---------------------------------------------------------------------------
// Array properties
// ---------------------------------------------------------------------------

void describe('TypeStringEmitter array emission', () => {
  void it('items schema produces T[] notation', () => {
    const result = emit({
      '$id': 'https://example.com/Library',
      'properties': {
        'tags': {
          'items': { 'type': 'string' },
          'type': 'array'
        }
      },
      'required': ['tags'],
      'type': 'object'
    });

    assert.match(result, /tags:\s*string\[\]/u, `expected tags: string[], got: ${result}`);
  });

  void it('root array schema with items produces T[]', () => {
    const result = emit({
      '$id': 'https://example.com/TagList',
      'items': { 'type': 'number' },
      'type': 'array'
    });

    assert.match(result, /number\[\]/u, `expected number[], got: ${result}`);
  });

  void it('prefixItems produce a tuple type', () => {
    const result = emit({
      '$id': 'https://example.com/Pair',
      'prefixItems': [
        { 'type': 'string' },
        { 'type': 'number' }
      ],
      'type': 'array'
    });

    assert.match(result, /\[string,\s*number\]/u, `expected tuple [string, number], got: ${result}`);
  });
});

// ---------------------------------------------------------------------------
// Enum
// ---------------------------------------------------------------------------

void describe('TypeStringEmitter enum emission', () => {
  void it('enum values produce a union of string literals', () => {
    const result = emit({
      '$id': 'https://example.com/Status',
      'enum': [
        'active',
        'inactive',
        'pending'
      ]
    });

    assert.match(result, /"active"/u, `expected "active" literal, got: ${result}`);
    assert.match(result, /"inactive"/u, `expected "inactive" literal, got: ${result}`);
    assert.match(result, /"pending"/u, `expected "pending" literal, got: ${result}`);
    // All three connected by union
    assert.ok(result.includes('|'), `expected union operator |, got: ${result}`);
  });

  void it('enum with mixed types emits each value as a literal', () => {
    const result = emit({
      '$id': 'https://example.com/Mixed',
      'enum': [
        1,
        'two',
        true,
        null
      ]
    });

    assert.match(result, /\b1\b/u);
    assert.match(result, /"two"/u);
    assert.match(result, /true/u);
    assert.match(result, /null/u);
  });
});

// ---------------------------------------------------------------------------
// Nested object property
// ---------------------------------------------------------------------------

void describe('TypeStringEmitter nested objects', () => {
  void it('nested object property renders inline object shape', () => {
    const result = emit({
      '$id': 'https://example.com/Order',
      'properties': {
        'address': {
          'properties': {
            'city': { 'type': 'string' },
            'zip': { 'type': 'string' }
          },
          'required': ['city'],
          'type': 'object'
        }
      },
      'required': ['address'],
      'type': 'object'
    });

    // outer property present and required
    assert.match(result, /address:\s*\{/u, `outer required address: {, got: ${result}`);
    // inner properties visible
    assert.match(result, /city:\s*string/u);
    assert.match(result, /zip\?:\s*string/u);
  });
});

// ---------------------------------------------------------------------------
// Self-referential $ref (cycle protection)
// ---------------------------------------------------------------------------

void describe('TypeStringEmitter self-referential $ref', () => {
  void it('self-referential schema terminates and references by type name', () => {
    const result = emit({
      '$id': 'https://example.com/TreeNode',
      'properties': {
        'children': {
          'items': { '$ref': 'https://example.com/TreeNode' },
          'type': 'array'
        },
        'value': { 'type': 'number' }
      },
      'type': 'object'
    });

    // Must not throw and must be a finite string
    assert.ok(typeof result === 'string' && result.length > 0, 'emit should return non-empty string');
    // The children property must appear
    assert.match(result, /children/u, `expected children prop, got: ${result}`);
    // The referenced type name should appear (Treenode or TreeNode variant via deriveTypeName)
    assert.ok(
      result.includes('Treenode') || result.includes('treenode') || result.includes('TreeNode'),
      `expected type name reference for cycle, got: ${result}`
    );
  });

  void it('self-referential schema does not infinite-loop or stack-overflow', () => {
    // If this test completes within the test runner timeout, cycle protection works
    let threw = false;

    try {
      emit({
        '$id': 'https://example.com/Node',
        'properties': {
          'next': { '$ref': 'https://example.com/Node' },
          'val': { 'type': 'string' }
        },
        'type': 'object'
      });
    } catch {
      threw = true;
    }

    assert.ok(!threw, 'emit should not throw on self-referential schema');
  });
});

// ---------------------------------------------------------------------------
// anyOf / oneOf / allOf
// ---------------------------------------------------------------------------

void describe('TypeStringEmitter composition keywords', () => {
  void it('anyOf produces a union type', () => {
    const result = emit({
      '$id': 'https://example.com/StringOrNumber',
      'anyOf': [
        { 'type': 'string' },
        { 'type': 'number' }
      ]
    });

    assert.match(result, /string\s*\|\s*number/u, `expected string | number, got: ${result}`);
  });

  void it('oneOf produces a union type', () => {
    const result = emit({
      '$id': 'https://example.com/BoolOrNull',
      'oneOf': [
        { 'type': 'boolean' },
        { 'type': 'null' }
      ]
    });

    assert.match(result, /boolean\s*\|\s*null/u, `expected boolean | null, got: ${result}`);
  });
});

// ---------------------------------------------------------------------------
// Type name derivation
// ---------------------------------------------------------------------------

void describe('TypeStringEmitter type name derivation', () => {
  void it('derives type name from last path segment of $id', () => {
    const result = emit({
      '$id': 'https://example.com/my-domain/Customer',
      'type': 'object'
    });

    assert.match(result, /^type Customer\s*=/u, `expected "type Customer =", got: ${result}`);
  });

  void it('falls back to Root when $id is absent', () => {
    const result = emit({ 'type': 'object' });

    assert.match(result, /^type Root\s*=/u, `expected "type Root =", got: ${result}`);
  });
});
