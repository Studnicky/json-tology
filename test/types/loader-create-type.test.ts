/**
 * Runtime behavior tests for JsonTology.create with and without a loader.
 *
 * TypeScript types both forms as `JsonTology` (single overload for large-schema-array
 * compatibility), but at runtime `create({ loader })` returns a Promise. These tests
 * verify the runtime contract: sync without loader, Promise with loader.
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import type { LoaderType } from '../../src/types/Loader.js';
import { JsonTology } from '../../src/JsonTology.js';

const noOpLoader: LoaderType = async (_: string) => {
  return null;
};

const AddressSchema = {
  '$id': 'https://schema.example/Address',
  'properties': { 'city': { 'type': 'string' } },
  'type': 'object'
} as const;

void describe('JsonTology.create runtime return type', () => {
  void it('create without loader returns JsonTology instance (not a Promise)', () => {
    const result = JsonTology.create({
      'baseIRI': 'https://schema.example',
      'schemas': [AddressSchema] as const
    });

    // Must NOT be a Promise — synchronous return
    assert.ok(!(result instanceof Promise), 'no-loader create() must return synchronously');
    assert.ok(result instanceof JsonTology, 'no-loader create() returns JsonTology');

    const hasAddr: boolean = result.has(AddressSchema.$id);

    void hasAddr;
  });

  void it('create with loader returns Promise<JsonTology> at runtime', async () => {
    // TypeScript types this as JsonTology (single overload), but at runtime it is a Promise
    const result = JsonTology.create({
      'baseIRI': 'https://schema.example',
      'loader': noOpLoader,
      'schemas': [] as const
    });

    // Runtime assertion: IS a Promise
    assert.ok(result instanceof Promise, 'loader create() must return a Promise at runtime');

    const jt = await (result as unknown as Promise<JsonTology>);

    assert.ok(jt instanceof JsonTology, 'resolved value is JsonTology');

    const hasAddr: boolean = jt.has(AddressSchema.$id);

    void hasAddr;
  });
});
