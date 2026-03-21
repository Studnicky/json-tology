/**
 * Transform / brand tests
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { Transform } from '../../src/modules/transform/Transform.js';
import { JsonTology } from '../../src/JsonTology.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DateTimeSchema = {
  '$id': 'https://myapp.io/DateTime',
  'format': 'date-time',
  'type': 'string'
} as const;

const TransformedDateSchema = Transform.create(DateTimeSchema, {
  'decode': (raw: string) => {
    return new Date(raw);
  },
  'encode': (date: Date) => {
    return date.toISOString();
  }
});

const UserSchema = {
  '$id': 'https://myapp.io/User',
  'properties': {
    'name': { 'type': 'string' },
    'score': {
      'default': 0,
      'type': 'number'
    }
  },
  'required': ['name'],
  'type': 'object'
} as const;

// ---------------------------------------------------------------------------
// Transform.create()
// ---------------------------------------------------------------------------

void describe('Transform.create()', () => {
  void it('preserves schema, coerce() applies decode, rejects invalid, and encode() round-trips', () => {
    // Schema identity preserved
    assert.equal(TransformedDateSchema.$id, DateTimeSchema.$id);
    assert.equal(TransformedDateSchema.type, DateTimeSchema.type);

    const jt = JsonTology.create({
      'baseIRI': 'https://myapp.io',
      'schemas': [TransformedDateSchema] as const
    });

    // coerce() applies decode
    const result = jt.coerce(TransformedDateSchema.$id, '2024-06-01T00:00:00.000Z');

    assert.ok(result instanceof Date);
    assert.equal(result.getFullYear(), 2024);

    // coerce() rejects invalid data
    assert.throws(
      () => {
        return jt.coerce(TransformedDateSchema.$id, 'not-a-date');
      },
      (err: unknown) => {
        return (err as Error).constructor.name === 'CoercionError';
      }
    );

    // encode() converts back to wire format
    const dateValue = new Date('2024-06-01T00:00:00.000Z');
    const wire = jt.encode(TransformedDateSchema, dateValue);

    assert.equal(wire, '2024-06-01T00:00:00.000Z');

    // encode() returns value unchanged for non-transformed schemas
    jt.register(UserSchema);
    const val = {
      'name': 'Alice',
      'score': 42
    };
    // @ts-expect-error -- UserSchema has no transform, passing it to test runtime behaviour
    const passthrough = jt.encode(UserSchema as unknown, val);

    assert.deepEqual(passthrough, val);
  });
});

// ---------------------------------------------------------------------------
// Transform.brand()
// ---------------------------------------------------------------------------

void describe('Transform.brand()', () => {
  void it('preserves schema identity and validates correctly', () => {
    const UserIdSchema = Transform.brand(
      {
        '$id': 'https://myapp.io/UserId',
        'type': 'string'
      } as const,
      'UserId'
    );

    assert.equal(UserIdSchema.$id, 'https://myapp.io/UserId');
    assert.equal(UserIdSchema.type, 'string');

    const UserIdSchema2 = Transform.brand(
      {
        '$id': 'https://myapp.io/UserId2',
        'type': 'string'
      } as const,
      'UserId'
    );
    const jt = JsonTology.create({ 'baseIRI': 'https://myapp.io' });

    jt.register(UserIdSchema2);
    assert.equal(jt.validate(UserIdSchema2.$id, 'abc').length, 0);
    assert.ok(jt.validate(UserIdSchema2.$id, 123).length > 0);
  });
});

// ---------------------------------------------------------------------------
// Transform contract alignment
// ---------------------------------------------------------------------------

void describe('Transform contract alignment', () => {
  void it('coerce() decodes, materialize() returns wire-form, encode() returns wire-form', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://myapp.io',
      'schemas': [
        TransformedDateSchema,
        UserSchema
      ] as const
    });

    // coerce() returns decoded output
    const parsed = jt.coerce(TransformedDateSchema.$id, '2024-06-01T00:00:00.000Z');

    assert.ok(parsed instanceof Date);
    assert.equal(parsed.toISOString(), '2024-06-01T00:00:00.000Z');

    // materialize() returns wire-form, not decoded
    const materialized = jt.materialize(TransformedDateSchema, '2024-06-01T00:00:00.000Z');

    assert.equal(typeof materialized, 'string');
    assert.equal(materialized, '2024-06-01T00:00:00.000Z');

    // encode() returns wire-form
    const wire = jt.encode(TransformedDateSchema, new Date('2024-06-01T00:00:00.000Z'));

    assert.equal(typeof wire, 'string');
    assert.equal(wire, '2024-06-01T00:00:00.000Z');

    // materialize() works for non-transformed schemas too
    const userResult = jt.materialize(UserSchema, { 'name': 'Alice' });

    assert.deepEqual(userResult, {
      'name': 'Alice',
      'score': 0
    });
  });
});

// ---------------------------------------------------------------------------
// Transform.pipe()
// ---------------------------------------------------------------------------

void describe('Transform.pipe()', () => {
  void it('composes decode left-to-right, encode right-to-left, and round-trips through JsonTology', () => {
    const PipeSchema = {
      '$id': 'https://myapp.io/PipeTest',
      'type': 'string'
    } as const;

    const piped = Transform.pipe(PipeSchema, [
      {
        'decode': (value: string) => {
          return value.trim();
        },
        'encode': (value: string) => {
          return ` ${value} `;
        }
      },
      {
        'decode': (value: string) => {
          return value.toUpperCase();
        },
        'encode': (value: string) => {
          return value.toLowerCase();
        }
      }
    ]);

    // Schema identity preserved
    assert.equal(piped.$id, PipeSchema.$id);

    const jt = JsonTology.create({
      'baseIRI': 'https://myapp.io',
      'schemas': [piped] as const
    });

    // decode: trim then uppercase
    const parsed = jt.coerce(piped.$id, '  hello  ');

    assert.equal(parsed, 'HELLO');

    // encode: lowercase then pad
    const wire = jt.encode(piped, 'HELLO');

    assert.equal(wire, ' hello ');
  });
});
