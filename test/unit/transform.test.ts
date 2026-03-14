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
  'decode': (s: string) => {
    return new Date(s);
  },
  'encode': (d: Date) => {
    return d.toISOString();
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

describe('Transform.create()', () => {
  it('returns the schema object unchanged at runtime', () => {
    assert.equal(TransformedDateSchema.$id, DateTimeSchema.$id);
    assert.equal(TransformedDateSchema.type, DateTimeSchema.type);
  });

  it('parse() applies decode function after validation', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://myapp.io',
      'schemas': [TransformedDateSchema] as const
    });
    const result = jt.parse(TransformedDateSchema.$id, '2024-06-01T00:00:00.000Z');

    assert.ok(result instanceof Date);
    assert.equal(result.getFullYear(), 2024);
  });

  it('parse() still throws ParseError on invalid data', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://myapp.io',
      'schemas': [TransformedDateSchema] as const
    });

    assert.throws(
      () => {
        return jt.parse(TransformedDateSchema.$id, 'not-a-date');
      },
      (err: unknown) => {
        return (err as Error).constructor.name === 'ParseError';
      }
    );
  });

  it('encode() converts decoded value back to wire format', () => {
    const jt = JsonTology.create({ 'baseIRI': 'https://myapp.io' });

    jt.register(TransformedDateSchema);
    const d = new Date('2024-06-01T00:00:00.000Z');
    const wire = jt.encode(TransformedDateSchema, d);

    assert.equal(wire, '2024-06-01T00:00:00.000Z');
  });

  it('encode() returns value unchanged for schemas without a transform', () => {
    const jt = JsonTology.create({ 'baseIRI': 'https://myapp.io' });

    jt.register(UserSchema);
    const val = {
      'name': 'Alice',
      'score': 42
    };
    // @ts-expect-error — UserSchema has no transform, passing it to test runtime behaviour
    const result = jt.encode(UserSchema as any, val);

    assert.deepEqual(result, val);
  });
});

// ---------------------------------------------------------------------------
// Transform.brand()
// ---------------------------------------------------------------------------

describe('Transform.brand()', () => {
  it('returns the schema object unchanged at runtime', () => {
    const UserIdSchema = Transform.brand(
      {
        '$id': 'https://myapp.io/UserId',
        'type': 'string'
      } as const,
      'UserId'
    );

    assert.equal(UserIdSchema.$id, 'https://myapp.io/UserId');
    assert.equal(UserIdSchema.type, 'string');
  });

  it('branded schema validates correctly', () => {
    const UserIdSchema = Transform.brand(
      {
        '$id': 'https://myapp.io/UserId2',
        'type': 'string'
      } as const,
      'UserId'
    );
    const jt = JsonTology.create({ 'baseIRI': 'https://myapp.io' });

    jt.register(UserIdSchema);
    const errs = jt.validate(UserIdSchema.$id, 'abc');

    assert.equal(errs.length, 0);
    const errs2 = jt.validate(UserIdSchema.$id, 123);

    assert.ok(errs2.length > 0);
  });
});

// ---------------------------------------------------------------------------
// Transform contract alignment (Task 01)
// ---------------------------------------------------------------------------

describe('Transform contract alignment', () => {
  const jt = JsonTology.create({
    'baseIRI': 'https://myapp.io',
    'schemas': [
      TransformedDateSchema,
      UserSchema
    ] as const
  });

  it('parse() returns decoded output for transformed schemas', () => {
    const result = jt.parse(TransformedDateSchema.$id, '2024-06-01T00:00:00.000Z');

    assert.ok(result instanceof Date, 'parse() must decode transformed schemas');
    assert.equal(result.toISOString(), '2024-06-01T00:00:00.000Z');
  });

  it('materialize() returns wire-form value, not decoded output', () => {
    const result = jt.materialize(TransformedDateSchema, '2024-06-01T00:00:00.000Z');

    assert.equal(typeof result, 'string', 'materialize() must return wire-form string, not Date');
    assert.equal(result, '2024-06-01T00:00:00.000Z');
  });

  it('encode() returns wire-form value', () => {
    const d = new Date('2024-06-01T00:00:00.000Z');
    const wire = jt.encode(TransformedDateSchema, d);

    assert.equal(typeof wire, 'string', 'encode() must return wire-form string');
    assert.equal(wire, '2024-06-01T00:00:00.000Z');
  });

  it('materialize() returns wire-form for non-transformed schemas too', () => {
    const result = jt.materialize(UserSchema, { 'name': 'Alice' });

    assert.deepEqual(result, {
      'name': 'Alice',
      'score': 0
    });
  });
});
