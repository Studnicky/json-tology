/**
 * Discriminator Validation Tests
 *
 * Tests discriminator optimization in oneOf validation, oneOf/anyOf edge cases,
 * and discriminated union patterns using const properties.
 *
 * json-tology requires inline nested objects in oneOf/anyOf to be extracted
 * to separate schemas with $id and referenced via $ref.
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { SchemaRegistry } from '../../src/modules/registry/SchemaRegistry.js';

// ---------------------------------------------------------------------------
// oneOf edge cases
// ---------------------------------------------------------------------------

void describe('oneOf edge cases', () => {
  void it('validates oneOf edge-case scenarios', () => {
    const registry = new SchemaRegistry();

    registry.register({
      '$id': 'https://disc.test/BranchA',
      'properties': { 'x': { 'type': 'number' } },
      'required': ['x'],
      'type': 'object'
    });

    registry.register({
      '$id': 'https://disc.test/BranchB',
      'properties': {
        'x': { 'type': 'number' },
        'y': { 'type': 'number' }
      },
      'required': ['x'],
      'type': 'object'
    });

    registry.register({
      '$id': 'https://disc.test/OverlapOneOf',
      'oneOf': [
        { '$ref': 'https://disc.test/BranchA' },
        { '$ref': 'https://disc.test/BranchB' }
      ],
      'type': 'object'
    });

    registry.register({
      '$id': 'https://disc.test/EmptyOneOf',
      'oneOf': [],
      'type': 'object'
    });

    registry.register({
      '$id': 'https://disc.test/BoolOneOf',
      'oneOf': [
        true,
        false
      ]
    });

    registry.register({
      '$id': 'https://disc.test/StringObj',
      'properties': { 'a': { 'type': 'string' } },
      'type': 'object'
    });

    registry.register({
      '$id': 'https://disc.test/IdenticalOneOf',
      'oneOf': [
        { '$ref': 'https://disc.test/StringObj' },
        { '$ref': 'https://disc.test/StringObj' }
      ],
      'type': 'object'
    });

    const scenarios: Array<{ 'data': unknown;
      'name': string;
      'schema': string;
      'valid': boolean }> = [
      {
        'data': { 'x': 1 },
        'name': 'rejects value matching both oneOf branches (overlapping schemas)',
        'schema': 'https://disc.test/OverlapOneOf',
        'valid': false
      },
      {
        'data': { 'any': 'value' },
        'name': 'treats empty oneOf as vacuously true',
        'schema': 'https://disc.test/EmptyOneOf',
        'valid': true
      },
      {
        'data': { 'key': 'value' },
        'name': 'validates oneOf with boolean schemas (true+false yields exactly one match)',
        'schema': 'https://disc.test/BoolOneOf',
        'valid': true
      },
      {
        'data': { 'a': 'hello' },
        'name': 'rejects value when oneOf has identical $ref schemas (matches both)',
        'schema': 'https://disc.test/IdenticalOneOf',
        'valid': false
      }
    ];

    for (const {
      data, name, schema, valid
    } of scenarios) {
      const errors = registry.validate(schema, data);

      assert.equal(errors.length === 0, valid, name);
    }
  });
});

// ---------------------------------------------------------------------------
// anyOf edge cases
// ---------------------------------------------------------------------------

void describe('anyOf edge cases', () => {
  void it('validates anyOf edge-case scenarios', () => {
    const registry = new SchemaRegistry();

    registry.register({
      '$id': 'https://disc.test/AnyBranchX',
      'properties': { 'x': { 'type': 'number' } },
      'required': ['x'],
      'type': 'object'
    });

    registry.register({
      '$id': 'https://disc.test/AnyBranchY',
      'properties': { 'y': { 'type': 'number' } },
      'required': ['y'],
      'type': 'object'
    });

    registry.register({
      '$id': 'https://disc.test/NoMatchAnyOf',
      'anyOf': [
        { '$ref': 'https://disc.test/AnyBranchX' },
        { '$ref': 'https://disc.test/AnyBranchY' }
      ],
      'type': 'object'
    });

    registry.register({
      '$id': 'https://disc.test/AllBranchReqX',
      'properties': { 'x': { 'type': 'number' } },
      'required': ['x'],
      'type': 'object'
    });

    registry.register({
      '$id': 'https://disc.test/AllBranchOptX',
      'properties': { 'x': { 'type': 'number' } },
      'type': 'object'
    });

    registry.register({
      '$id': 'https://disc.test/AllMatchAnyOf',
      'anyOf': [
        { '$ref': 'https://disc.test/AllBranchReqX' },
        { '$ref': 'https://disc.test/AllBranchOptX' }
      ],
      'type': 'object'
    });

    registry.register({
      '$id': 'https://disc.test/EmptyAnyOf',
      'anyOf': [],
      'type': 'object'
    });

    const scenarios: Array<{ 'data': unknown;
      'name': string;
      'schema': string;
      'valid': boolean }> = [
      {
        'data': { 'z': 'nope' },
        'name': 'rejects value that matches no anyOf branch',
        'schema': 'https://disc.test/NoMatchAnyOf',
        'valid': false
      },
      {
        'data': { 'x': 42 },
        'name': 'accepts value that matches all anyOf branches',
        'schema': 'https://disc.test/AllMatchAnyOf',
        'valid': true
      },
      {
        'data': { 'any': 'value' },
        'name': 'treats empty anyOf as vacuously true',
        'schema': 'https://disc.test/EmptyAnyOf',
        'valid': true
      }
    ];

    for (const {
      data, name, schema, valid
    } of scenarios) {
      const errors = registry.validate(schema, data);

      assert.equal(errors.length === 0, valid, name);
    }
  });
});

// ---------------------------------------------------------------------------
// Discriminated union patterns (const-based discriminator via $ref)
// ---------------------------------------------------------------------------

void describe('Discriminated union validation', () => {
  void it('validates Shape discriminated union scenarios', () => {
    const registry = new SchemaRegistry();

    registry.register({
      '$id': 'https://disc.test/Circle',
      'properties': {
        'kind': { 'const': 'circle' },
        'radius': { 'type': 'number' }
      },
      'required': [
        'kind',
        'radius'
      ],
      'type': 'object'
    });

    registry.register({
      '$id': 'https://disc.test/Square',
      'properties': {
        'kind': { 'const': 'square' },
        'side': { 'type': 'number' }
      },
      'required': [
        'kind',
        'side'
      ],
      'type': 'object'
    });

    registry.register({
      '$id': 'https://disc.test/Shape',
      'oneOf': [
        { '$ref': 'https://disc.test/Circle' },
        { '$ref': 'https://disc.test/Square' }
      ],
      'type': 'object'
    });

    const scenarios: Array<{ 'data': unknown;
      'name': string;
      'valid': boolean }> = [
      {
        'data': {
          'kind': 'circle',
          'radius': 5
        },
        'name': 'valid circle',
        'valid': true
      },
      {
        'data': {
          'kind': 'square',
          'side': 10
        },
        'name': 'valid square',
        'valid': true
      },
      {
        'data': { 'radius': 5 },
        'name': 'rejects when discriminator property is missing',
        'valid': false
      },
      {
        'data': {
          'kind': 'triangle',
          'sides': 3
        },
        'name': 'rejects when discriminator value matches no branch',
        'valid': false
      },
      {
        'data': {
          'kind': 42,
          'radius': 5
        },
        'name': 'rejects when discriminator value is a number',
        'valid': false
      },
      {
        'data': {
          'kind': null,
          'radius': 5
        },
        'name': 'rejects when discriminator value is null',
        'valid': false
      }
    ];

    for (const {
      data, name, valid
    } of scenarios) {
      const errors = registry.validate('https://disc.test/Shape', data);

      assert.equal(errors.length === 0, valid, name);
    }
  });

  void it('validates Event discriminated union with branch-specific constraints', () => {
    const registry = new SchemaRegistry();

    registry.register({
      '$id': 'https://disc.test/MessageEvent',
      'properties': {
        'payload': { 'type': 'string' },
        'type': { 'const': 'message' }
      },
      'required': [
        'type',
        'payload'
      ],
      'type': 'object'
    });

    registry.register({
      '$id': 'https://disc.test/ErrorEvent',
      'properties': {
        'code': { 'type': 'number' },
        'type': { 'const': 'error' }
      },
      'required': [
        'type',
        'code'
      ],
      'type': 'object'
    });

    registry.register({
      '$id': 'https://disc.test/LogEvent',
      'properties': {
        'level': {
          'enum': [
            'info',
            'warn',
            'error'
          ]
        },
        'type': { 'const': 'log' }
      },
      'required': [
        'type',
        'level'
      ],
      'type': 'object'
    });

    registry.register({
      '$id': 'https://disc.test/Event',
      'oneOf': [
        { '$ref': 'https://disc.test/MessageEvent' },
        { '$ref': 'https://disc.test/ErrorEvent' },
        { '$ref': 'https://disc.test/LogEvent' }
      ],
      'type': 'object'
    });

    const scenarios: Array<{ 'data': unknown;
      'name': string;
      'valid': boolean }> = [
      {
        'data': {
          'payload': 'hello',
          'type': 'message'
        },
        'name': 'valid message event',
        'valid': true
      },
      {
        'data': {
          'code': 404,
          'type': 'error'
        },
        'name': 'valid error event',
        'valid': true
      },
      {
        'data': {
          'level': 'warn',
          'type': 'log'
        },
        'name': 'valid log event',
        'valid': true
      },
      {
        'data': { 'type': 'message' },
        'name': 'rejects when branch-specific required field is missing',
        'valid': false
      },
      {
        'data': {
          'code': 'not-a-number',
          'type': 'error'
        },
        'name': 'rejects when branch-specific field has wrong type',
        'valid': false
      },
      {
        'data': {
          'level': 'debug',
          'type': 'log'
        },
        'name': 'rejects when branch-specific enum value is invalid',
        'valid': false
      }
    ];

    for (const {
      data, name, valid
    } of scenarios) {
      const errors = registry.validate('https://disc.test/Event', data);

      assert.equal(errors.length === 0, valid, name);
    }
  });
});
