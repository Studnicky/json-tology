/**
 * Transform / withCatch / brand tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Transform } from '../../src/schema/Transform.js';
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

const NumberSchema = {
  $id: 'https://myapp.io/Count',
  type: 'integer',
} as const;

const UserSchema = {
  $id: 'https://myapp.io/User',
  type: 'object',
  properties: {
    name:  { type: 'string' },
    score: { type: 'number', default: 0 },
  },
  required: ['name'],
} as const;

const SafeUserSchema = Transform.withCatch(UserSchema, { name: 'guest', score: 0 });

// ---------------------------------------------------------------------------
// Transform.create()
// ---------------------------------------------------------------------------

describe('Transform.create()', () => {
  it('returns the schema object unchanged at runtime', () => {
    assert.equal(TransformedDateSchema.$id, DateTimeSchema.$id);
    assert.equal(TransformedDateSchema.type, DateTimeSchema.type);
  });

  it('parse() applies decode function after validation', () => {
    const jt = new JsonTology({ baseIRI: 'https://myapp.io' });
    const result = jt.parse(TransformedDateSchema, '2024-06-01T00:00:00.000Z');
    assert.ok(result instanceof Date);
    assert.equal(result.getFullYear(), 2024);
  });

  it('parse() still throws ParseError on invalid data', () => {
    const jt = new JsonTology({ baseIRI: 'https://myapp.io' });
    assert.throws(
      () => jt.parse(TransformedDateSchema, 'not-a-date'),
      (err: unknown) => (err as Error).constructor.name === 'ParseError',
    );
  });

  it('safeParse() returns decoded value on success', () => {
    const jt = new JsonTology({ baseIRI: 'https://myapp.io' });
    const result = jt.safeParse(TransformedDateSchema, '2024-06-01T00:00:00.000Z');
    assert.equal(result.success, true);
    if (result.success) assert.ok(result.data instanceof Date);
  });

  it('encode() converts decoded value back to wire format', () => {
    const jt = new JsonTology({ baseIRI: 'https://myapp.io' });
    const d = new Date('2024-06-01T00:00:00.000Z');
    const wire = jt.encode(TransformedDateSchema, d);
    assert.equal(wire, '2024-06-01T00:00:00.000Z');
  });

  it('encode() returns value unchanged for schemas without a transform', () => {
    const jt = new JsonTology({ baseIRI: 'https://myapp.io' });
    const val = { name: 'Alice', score: 42 };
    // @ts-expect-error — UserSchema has no transform, passing it to test runtime behaviour
    const result = jt.encode(UserSchema as any, val);
    assert.deepEqual(result, val);
  });
});

// ---------------------------------------------------------------------------
// Transform.withCatch()
// ---------------------------------------------------------------------------

describe('Transform.withCatch()', () => {
  it('safeParse() returns fallback when validation fails', () => {
    const jt = new JsonTology({ baseIRI: 'https://myapp.io' });
    const result = jt.safeParse(SafeUserSchema, null);
    assert.equal(result.success, true);
    if (result.success) assert.deepEqual(result.data, { name: 'guest', score: 0 });
  });

  it('safeParse() returns parsed data when validation succeeds', () => {
    const jt = new JsonTology({ baseIRI: 'https://myapp.io' });
    const result = jt.safeParse(SafeUserSchema, { name: 'Alice', score: 99 });
    assert.equal(result.success, true);
    if (result.success) assert.equal((result.data as { name: string }).name, 'Alice');
  });

  it('parse() still throws on failure (withCatch only affects safeParse)', () => {
    const jt = new JsonTology({ baseIRI: 'https://myapp.io' });
    assert.throws(() => jt.parse(SafeUserSchema, null));
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
    const jt = new JsonTology({ baseIRI: 'https://myapp.io' });
    const errors = jt.validate(UserIdSchema.$id, 'abc');
    // UserIdSchema not registered yet via register(); validate uses $id
    // register it first
    jt.register(UserIdSchema);
    const errs = jt.validate(UserIdSchema.$id, 'abc');
    assert.equal(errs.length, 0);
    const errs2 = jt.validate(UserIdSchema.$id, 123);
    assert.ok(errs2.length > 0);
  });
});
