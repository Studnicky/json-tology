/**
 * Transform / brand tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Transform } from '../../src/modules/transform/Transform.js';
import { JsonTology } from '../../src/JsonTology.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DateTimeSchema = {
  $id: 'https://myapp.io/DateTime',
  type: 'string',
  format: 'date-time',
} as const;

const TransformedDateSchema = Transform.create(DateTimeSchema, {
  decode: (s: string) => new Date(s),
  encode: (d: Date) => d.toISOString(),
});

const UserSchema = {
  $id: 'https://myapp.io/User',
  type: 'object',
  properties: {
    name:  { type: 'string' },
    score: { type: 'number', default: 0 },
  },
  required: ['name'],
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
      baseIRI: 'https://myapp.io',
      schemas: [TransformedDateSchema] as const,
    });
    const result = jt.parse(TransformedDateSchema.$id, '2024-06-01T00:00:00.000Z');
    assert.ok(result instanceof Date);
    assert.equal(result.getFullYear(), 2024);
  });

  it('parse() still throws ParseError on invalid data', () => {
    const jt = JsonTology.create({
      baseIRI: 'https://myapp.io',
      schemas: [TransformedDateSchema] as const,
    });
    assert.throws(
      () => jt.parse(TransformedDateSchema.$id, 'not-a-date'),
      (err: unknown) => (err as Error).constructor.name === 'ParseError',
    );
  });

  it('encode() converts decoded value back to wire format', () => {
    const jt = JsonTology.create({ baseIRI: 'https://myapp.io' });
    jt.register(TransformedDateSchema);
    const d = new Date('2024-06-01T00:00:00.000Z');
    const wire = jt.encode(TransformedDateSchema, d);
    assert.equal(wire, '2024-06-01T00:00:00.000Z');
  });

  it('encode() returns value unchanged for schemas without a transform', () => {
    const jt = JsonTology.create({ baseIRI: 'https://myapp.io' });
    jt.register(UserSchema);
    const val = { name: 'Alice', score: 42 };
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
      { $id: 'https://myapp.io/UserId', type: 'string' } as const,
      'UserId',
    );
    assert.equal(UserIdSchema.$id, 'https://myapp.io/UserId');
    assert.equal(UserIdSchema.type, 'string');
  });

  it('branded schema validates correctly', () => {
    const UserIdSchema = Transform.brand(
      { $id: 'https://myapp.io/UserId2', type: 'string' } as const,
      'UserId',
    );
    const jt = JsonTology.create({ baseIRI: 'https://myapp.io' });
    jt.register(UserIdSchema);
    const errs = jt.validate(UserIdSchema.$id, 'abc');
    assert.equal(errs.length, 0);
    const errs2 = jt.validate(UserIdSchema.$id, 123);
    assert.ok(errs2.length > 0);
  });
});
