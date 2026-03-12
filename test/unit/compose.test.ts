/**
 * Schema Composition Tests
 */

import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { Compose } from '../../src/modules/composition/Compose.js';

const PersonSchema = {
  $id: 'https://example.io/person',
  type: 'object',
  properties: {
    name:  { type: 'string' },
    age:   { type: 'number' },
    email: { type: 'string' },
  },
  required: ['name', 'age'],
  additionalProperties: false,
} as const;

const AddressSchema = {
  $id: 'https://example.io/address',
  type: 'object',
  properties: {
    street: { type: 'string' },
    city:   { type: 'string' },
  },
  required: ['street'],
} as const;

// ---------------------------------------------------------------------------
// extend
// ---------------------------------------------------------------------------

describe('Compose.extend()', () => {
  it('merges new properties into schema', () => {
    const s = Compose.extend(
      PersonSchema,
      { role: { type: 'string' } } as const,
      'https://example.io/person-with-role',
    );
    assert.ok('name' in s.properties);
    assert.ok('role' in s.properties);
  });

  it('inherits required array unchanged', () => {
    const s = Compose.extend(
      PersonSchema,
      { role: { type: 'string' } } as const,
      'https://example.io/person-with-role',
    );
    assert.deepStrictEqual([...(s as any).required].sort(), ['age', 'name']);
  });

  it('sets the new $id', () => {
    const s = Compose.extend(
      PersonSchema,
      { role: { type: 'string' } } as const,
      'https://example.io/person-with-role',
    );
    assert.strictEqual(s.$id, 'https://example.io/person-with-role');
  });

  it('does not mutate source schema properties', () => {
    Compose.extend(
      PersonSchema,
      { role: { type: 'string' } } as const,
      'https://example.io/person-with-role',
    );
    assert.ok(!('role' in PersonSchema.properties));
  });
});

// ---------------------------------------------------------------------------
// intersection
// ---------------------------------------------------------------------------

describe('Compose.intersection()', () => {
  it('wraps schemas in allOf', () => {
    const result = Compose.intersection([PersonSchema, AddressSchema], 'https://example.io/PersonWithAddress');
    assert.ok('allOf' in result);
    assert.strictEqual((result as any).allOf.length, 2);
  });

  it('sets the new $id', () => {
    const result = Compose.intersection([PersonSchema, AddressSchema], 'https://example.io/Combined');
    assert.strictEqual(result.$id, 'https://example.io/Combined');
  });

  it('preserves constituent schemas in allOf', () => {
    const result = Compose.intersection([PersonSchema, AddressSchema], 'https://example.io/Combined');
    assert.deepStrictEqual((result as any).allOf[0], PersonSchema);
    assert.deepStrictEqual((result as any).allOf[1], AddressSchema);
  });

  it('does not mutate the source schemas', () => {
    const before = { ...PersonSchema };
    Compose.intersection([PersonSchema, AddressSchema], 'https://example.io/Combined');
    assert.deepStrictEqual(PersonSchema.required, before.required);
  });
});

// ---------------------------------------------------------------------------
// discriminatedUnion
// ---------------------------------------------------------------------------

describe('Compose.discriminatedUnion()', () => {
  const CircleSchema = {
    $id: 'https://example.io/circle',
    type: 'object',
    properties: { kind: { const: 'circle' }, radius: { type: 'number' } },
    required: ['kind'],
  } as const;

  const RectSchema = {
    $id: 'https://example.io/rect',
    type: 'object',
    properties: { kind: { const: 'rect' }, width: { type: 'number' } },
    required: ['kind'],
  } as const;

  it('wraps variants in oneOf', () => {
    const result = Compose.discriminatedUnion('kind', [CircleSchema, RectSchema], 'https://example.io/Shape');
    assert.ok('oneOf' in result);
    assert.strictEqual((result as any).oneOf.length, 2);
  });

  it('sets the discriminator propertyName', () => {
    const result = Compose.discriminatedUnion('kind', [CircleSchema, RectSchema], 'https://example.io/Shape');
    assert.deepStrictEqual((result as any).discriminator, { propertyName: 'kind' });
  });

  it('sets the new $id', () => {
    const result = Compose.discriminatedUnion('kind', [CircleSchema, RectSchema], 'https://example.io/Shape');
    assert.strictEqual(result.$id, 'https://example.io/Shape');
  });

  it('preserves variant schemas in oneOf', () => {
    const result = Compose.discriminatedUnion('kind', [CircleSchema, RectSchema], 'https://example.io/Shape');
    assert.deepStrictEqual((result as any).oneOf[0], CircleSchema);
    assert.deepStrictEqual((result as any).oneOf[1], RectSchema);
  });
});
