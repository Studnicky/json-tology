/**
 * API Unification Sweep — tests for items 1, 2, 3, 10
 *
 * Covers:
 * - Item 1: validate() returns ValidationErrors (not string[])
 * - Item 2: Trimmed ValidationErrors API — messages/format/flatten removed
 * - Item 3: Resolver.merge static class
 * - Item 10 (per spec amendment numbering): Path.toAccess static method
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { JsonTology } from '../../src/JsonTology.js';
import { Path } from '../../src/modules/data/Path.js';
import { Resolver } from '../../src/modules/data/Resolver.js';
import { ValidationErrors } from '../../src/errors/ValidationErrors.js';

const UserSchema = {
  '$id': 'https://api-unification.test/User',
  'properties': {
    'email': { 'type': 'string' },
    'name': { 'type': 'string' }
  },
  'required': [
    'email',
    'name'
  ],
  'type': 'object'
} as const;

// ---------------------------------------------------------------------------
// Item 1: validate() returns ValidationErrors
// ---------------------------------------------------------------------------

void describe('Item 1: validate() returns ValidationErrors', () => {
  const entities = JsonTology.create({
    'baseIRI': 'https://api-unification.test',
    'schemas': [UserSchema]
  });

  void it('returns ValidationErrors instance (not string[])', () => {
    const result = entities.validate(UserSchema.$id, {
      'email': 'a@b.com',
      'name': 'Alice'
    });

    assert.ok(result instanceof ValidationErrors, 'result is ValidationErrors');
  });

  void it('returns ok=true for valid data', () => {
    const result = entities.validate(UserSchema.$id, {
      'email': 'a@b.com',
      'name': 'Alice'
    });

    assert.equal(result.ok, true);
    assert.equal(result.length, 0);
  });

  void it('returns ok=false with items for invalid data', () => {
    const result = entities.validate(UserSchema.$id, { 'name': 'Alice' });

    assert.equal(result.ok, false);
    assert.ok(result.length > 0);
    assert.ok(typeof result.items[0].path === 'string');
    assert.ok(typeof result.items[0].keyword === 'string');
    assert.ok(typeof result.items[0].message === 'string');
  });

  void it('is iterable over ValidationErrorType items', () => {
    const result = entities.validate(UserSchema.$id, { 'name': 'Alice' });
    const collected = [];

    for (const err of result) {
      collected.push(err);
    }

    assert.equal(collected.length, result.length);
    assert.ok(typeof collected[0].keyword === 'string');
  });
});

// ---------------------------------------------------------------------------
// Item 2: ValidationErrors trimmed API — removed methods
// ---------------------------------------------------------------------------

void describe('Item 2: ValidationErrors trimmed API', () => {
  const errs = new ValidationErrors([
    {
      'keyword': 'type',
      'message': 'must be string',
      'params': {},
      'path': '/name'
    },
    {
      'keyword': 'required',
      'message': "must have required property 'email'",
      'params': { 'missingProperty': 'email' },
      'path': ''
    }
  ]);

  void it('messages() is not a function', () => {
    assert.equal(typeof (errs as unknown as Record<string, unknown>).messages, 'undefined');
  });

  void it('format() is not a function', () => {
    assert.equal(typeof (errs as unknown as Record<string, unknown>).format, 'undefined');
  });

  void it('flatten() is not a function on ValidationErrors', () => {
    // Note: InstantiationError/BaseError still have flatten() — this tests ValidationErrors only
    assert.equal(typeof (errs as unknown as Record<string, unknown>).flatten, 'undefined');
  });

  void it('aggregate() and report() still exist', () => {
    assert.equal(typeof errs.aggregate, 'function');
    assert.equal(typeof errs.report, 'function');
  });

  void it('items + map recipe replaces messages()', () => {
    const messages = errs.items.map((err) => {
      return `${err.path || 'root'}: ${err.message}`;
    });

    assert.ok(messages.some((msg) => {
      return msg.includes('/name');
    }));
    assert.ok(messages.some((msg) => {
      return msg.includes('root');
    }));
  });

  void it('aggregate() paths are in access form (not JSON Pointer)', () => {
    const rollup = errs.aggregate();

    // /name → 'name' (access form, no leading /)
    assert.ok(!rollup.paths.some((path) => {
      return path.startsWith('/');
    }), 'aggregate paths should not start with /');
    assert.ok(rollup.paths.some((path) => {
      return path === 'name';
    }), 'aggregate paths should include "name"');
  });

  void it('items still carry JSON Pointer paths', () => {
    assert.ok(errs.items.some((err) => {
      return err.path === '/name';
    }), 'items paths should be JSON Pointer format');
  });
});

// ---------------------------------------------------------------------------
// Item 3 (Resolver.merge): per-call option merging
// ---------------------------------------------------------------------------

void describe('Item 3: Resolver.merge', () => {
  void it('returns base when override is undefined', () => {
    const base = {
      'enableDefaults': true,
      'enableValidation': false
    };
    const result = Resolver.merge(base);

    assert.equal(result, base);
  });

  void it('merges defined override keys over base', () => {
    const base = {
      'enableDefaults': true,
      'enableValidation': false
    };
    const result = Resolver.merge(base, { 'enableDefaults': false });

    assert.equal(result.enableDefaults, false);
    assert.equal(result.enableValidation, false);
  });

  void it('does not apply undefined override keys', () => {
    const base = {
      'enableDefaults': true,
      'enableValidation': false
    };
    const result = Resolver.merge(base, { 'enableDefaults': undefined });

    assert.equal(result.enableDefaults, true, 'undefined key does not override base');
  });

  void it('returns a new object (does not mutate base)', () => {
    const base = { 'enableDefaults': true };
    const result = Resolver.merge(base, { 'enableDefaults': false });

    assert.equal(base.enableDefaults, true, 'base not mutated');
    assert.equal(result.enableDefaults, false);
  });
});

// ---------------------------------------------------------------------------
// Item 10 (Path.toAccess): JSON Pointer → access form
// ---------------------------------------------------------------------------

void describe('Path.toAccess', () => {
  void it('converts simple string segment', () => {
    assert.equal(Path.toAccess('/name'), 'name');
  });

  void it('converts numeric segment to bracket notation', () => {
    assert.equal(Path.toAccess('/items/0'), 'items[0]');
  });

  void it('converts nested path', () => {
    assert.equal(Path.toAccess('/items/0/quantity'), 'items[0].quantity');
  });

  void it('returns empty string for root pointer', () => {
    assert.equal(Path.toAccess(''), '');
    assert.equal(Path.toAccess('/'), '');
  });

  void it('handles keys requiring bracket notation', () => {
    assert.equal(Path.toAccess('/weird-key'), '["weird-key"]');
  });

  void it('decodes JSON Pointer escapes', () => {
    assert.equal(Path.toAccess('/a~1b'), '["a/b"]');
    assert.equal(Path.toAccess('/a~0b'), '["a~b"]');
  });
});
