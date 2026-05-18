/**
 * Type-level and runtime test for JsonTology.create.
 *
 * `create()` is always synchronous and returns `JsonTology`. Async transitive
 * `$ref` resolution lives in {@link JsonTology.prefetch}; the returned snapshot
 * is consumed sync via the `prefetched` option on `create`.
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import {
  JsonTology, Loaders
} from '../../src/index.js';

const AddressSchema = {
  '$id': 'https://schema.example/Address',
  'properties': { 'city': { 'type': 'string' } },
  'type': 'object'
} as const;

const UserSchema = {
  '$id': 'https://schema.example/User',
  'properties': {
    'address': { '$ref': 'https://schema.example/Address' },
    'name': { 'type': 'string' }
  },
  'type': 'object'
} as const;

void describe('JsonTology.create return type', () => {
  void it('create() returns JsonTology synchronously', () => {
    const result = JsonTology.create({
      'baseIRI': 'https://schema.example',
      'enableStrictGraph': false,
      'schemas': [AddressSchema] as const
    });

    // Compile-time: `.has()` is on JsonTology's registry; .then() would not type-check.
    const hasAddr: boolean = result.registry.has(AddressSchema.$id);

    assert.ok(result instanceof JsonTology);
    assert.ok(!(result instanceof Promise));
    assert.ok(hasAddr);
  });

  void it('create({ prefetched }) consumes a snapshot synchronously', async () => {
    const snapshot = await JsonTology.prefetch({
      'loader': Loaders.memory({
        [AddressSchema.$id]: AddressSchema,
        [UserSchema.$id]: UserSchema
      }),
      'schemas': [UserSchema]
    });

    const jt = JsonTology.create({
      'baseIRI': 'https://schema.example',
      'enableStrictGraph': false,
      'prefetched': snapshot,
      'schemas': [UserSchema] as const
    });

    assert.ok(jt instanceof JsonTology);
    assert.ok(jt.registry.has(AddressSchema.$id));
  });
});
