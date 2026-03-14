/**
 * Schema Composition Tests
 */

import {
  describe, it
} from 'node:test';
import * as assert from 'node:assert';
import { Compose } from '../../src/modules/composition/Compose.js';

const PersonSchema = {
  '$id': 'https://example.io/person',
  'additionalProperties': false,
  'properties': {
    'age': { 'type': 'number' },
    'email': { 'type': 'string' },
    'name': { 'type': 'string' }
  },
  'required': [
    'name',
    'age'
  ],
  'type': 'object'
} as const;

const AddressSchema = {
  '$id': 'https://example.io/address',
  'properties': {
    'city': { 'type': 'string' },
    'street': { 'type': 'string' }
  },
  'required': ['street'],
  'type': 'object'
} as const;

// ---------------------------------------------------------------------------
// extend
// ---------------------------------------------------------------------------

describe('Compose.extend()', () => {
  it('merges new properties into schema', () => {
    const s = Compose.extend(
      PersonSchema,
      { 'role': { 'type': 'string' } } as const,
      'https://example.io/person-with-role'
    );

    assert.ok('name' in s.properties);
    assert.ok('role' in s.properties);
  });

  it('inherits required array unchanged', () => {
    const s = Compose.extend(
      PersonSchema,
      { 'role': { 'type': 'string' } } as const,
      'https://example.io/person-with-role'
    );

    assert.deepStrictEqual([...s.required].sort(), [
      'age',
      'name'
    ]);
  });

  it('sets the new $id', () => {
    const s = Compose.extend(
      PersonSchema,
      { 'role': { 'type': 'string' } } as const,
      'https://example.io/person-with-role'
    );

    assert.strictEqual(s.$id, 'https://example.io/person-with-role');
  });

  it('does not mutate source schema properties', () => {
    Compose.extend(
      PersonSchema,
      { 'role': { 'type': 'string' } } as const,
      'https://example.io/person-with-role'
    );
    assert.ok(!('role' in PersonSchema.properties));
  });
});

// ---------------------------------------------------------------------------
// intersection
// ---------------------------------------------------------------------------

describe('Compose.intersection()', () => {
  it('wraps schemas in allOf', () => {
    const result = Compose.intersection([
      PersonSchema,
      AddressSchema
    ], 'https://example.io/PersonWithAddress');

    assert.ok('allOf' in result);
    assert.strictEqual(result.allOf.length, 2);
  });

  it('sets the new $id', () => {
    const result = Compose.intersection([
      PersonSchema,
      AddressSchema
    ], 'https://example.io/Combined');

    assert.strictEqual(result.$id, 'https://example.io/Combined');
  });

  it('preserves constituent schemas in allOf', () => {
    const result = Compose.intersection([
      PersonSchema,
      AddressSchema
    ], 'https://example.io/Combined');

    assert.deepStrictEqual(result.allOf[0], PersonSchema);
    assert.deepStrictEqual(result.allOf[1], AddressSchema);
  });

  it('does not mutate the source schemas', () => {
    const before = { ...PersonSchema };

    Compose.intersection([
      PersonSchema,
      AddressSchema
    ], 'https://example.io/Combined');
    assert.deepStrictEqual(PersonSchema.required, before.required);
  });
});

// ---------------------------------------------------------------------------
// discriminatedUnion
// ---------------------------------------------------------------------------

describe('Compose.discriminatedUnion()', () => {
  const CircleSchema = {
    '$id': 'https://example.io/circle',
    'properties': {
      'kind': { 'const': 'circle' },
      'radius': { 'type': 'number' }
    },
    'required': ['kind'],
    'type': 'object'
  } as const;

  const RectSchema = {
    '$id': 'https://example.io/rect',
    'properties': {
      'kind': { 'const': 'rect' },
      'width': { 'type': 'number' }
    },
    'required': ['kind'],
    'type': 'object'
  } as const;

  it('wraps variants in oneOf', () => {
    const result = Compose.discriminatedUnion('kind', [
      CircleSchema,
      RectSchema
    ], 'https://example.io/Shape');

    assert.ok('oneOf' in result);
    assert.strictEqual(result.oneOf.length, 2);
  });

  it('sets the discriminator propertyName', () => {
    const result = Compose.discriminatedUnion('kind', [
      CircleSchema,
      RectSchema
    ], 'https://example.io/Shape');

    assert.deepStrictEqual(result.discriminator, { 'propertyName': 'kind' });
  });

  it('sets the new $id', () => {
    const result = Compose.discriminatedUnion('kind', [
      CircleSchema,
      RectSchema
    ], 'https://example.io/Shape');

    assert.strictEqual(result.$id, 'https://example.io/Shape');
  });

  it('preserves variant schemas in oneOf', () => {
    const result = Compose.discriminatedUnion('kind', [
      CircleSchema,
      RectSchema
    ], 'https://example.io/Shape');

    assert.deepStrictEqual(result.oneOf[0], CircleSchema);
    assert.deepStrictEqual(result.oneOf[1], RectSchema);
  });
});
