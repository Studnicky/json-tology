import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { BaseTypes } from '../../src/modules/data/BaseTypes.js';
import { SchemaRegistry } from '../../src/modules/registry/SchemaRegistry.js';

void describe('BaseTypes — cross-module registry integration', () => {
  void it('make*Schema() validates via registry with $ref', () => {
    // enableStrictGraph: false — BaseTypes.page() factory produces schemas with
    // inline primitive shapes (minimum) by design; this tests registry integration.
    const registry = new SchemaRegistry({ 'enableStrictGraph': false });
    const IdBodySchema = {
      '$id': 'https://test.io/IdBody',
      'properties': { 'id': { 'type': 'number' } },
      'type': 'object'
    } as const;
    const responseSchema = BaseTypes.response(
      { '$ref': 'https://test.io/IdBody' } as const,
      'https://test.io/IdResponse'
    );

    registry.set([
      IdBodySchema,
      responseSchema
    ]);
    assert.equal(registry.validate(responseSchema.$id, {
      'body': { 'id': 1 },
      'success': true
    }).length, 0);

    const NameItemSchema = {
      '$id': 'https://test.io/NameItem',
      'properties': { 'name': { 'type': 'string' } },
      'type': 'object'
    } as const;
    const pageSchema = BaseTypes.page(
      { '$ref': 'https://test.io/NameItem' } as const,
      'https://test.io/NamePage'
    );

    registry.set([
      NameItemSchema,
      pageSchema
    ]);
    assert.equal(registry.validate(pageSchema.$id, {
      'items': [{ 'name': 'Alice' }],
      'page': 1,
      'pageSize': 20,
      'total': 1
    }).length, 0);

    // Rejects missing required fields
    const aPageSchema = BaseTypes.page({ 'type': 'object' } as const, 'https://test.io/APage');

    registry.set(aPageSchema);
    assert.ok(registry.validate(aPageSchema.$id, { 'items': [] }).length > 0);
  });
});
