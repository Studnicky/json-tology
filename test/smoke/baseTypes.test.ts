import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { BaseTypes } from '../../src/modules/data/BaseTypes.js';
import { SchemaRegistry } from '../../src/modules/registry/SchemaRegistry.js';

void describe('BaseTypes', () => {
  void it('Schema has $id and $defs with all expected types, standalone schemas have $id', () => {
    assert.equal(typeof BaseTypes.Schema.$id, 'string');
    assert.equal(typeof BaseTypes.Schema.$defs, 'object');
    const defs = BaseTypes.Schema.$defs;

    assert.ok('Pagination' in defs);
    assert.ok('Filter' in defs);
    assert.ok('Page' in defs);
    assert.ok('SortOrder' in defs);
    assert.ok('Cursor' in defs);

    assert.ok(BaseTypes.ResponseSchema.$id);
    assert.ok(BaseTypes.ResultSchema.$id);
    assert.ok(BaseTypes.PaginationSchema.$id);
    assert.ok(BaseTypes.FilterSchema.$id);
    assert.ok(BaseTypes.PageSchema.$id);
  });

  void it('validates all schema types and rejects invalid data', () => {
    const registry = new SchemaRegistry();
    const scenarios: Array<{ 'invalid'?: { 'data': unknown };
      'schema': Record<string, unknown> & { '$id': string };
      'valid': unknown }> = [
      {
        'invalid': { 'data': { 'success': 'yes' } },
        'schema': BaseTypes.ResponseSchema,
        'valid': { 'success': true }
      },
      {
        'schema': BaseTypes.ResultSchema,
        'valid': {
          'errorCode': 'ERR_001',
          'success': false
        }
      },
      {
        'invalid': { 'data': { 'pageSize': 0 } },
        'schema': BaseTypes.PaginationSchema,
        'valid': {
          'page': 2,
          'pageSize': 10
        }
      },
      {
        'invalid': { 'data': { 'value': 'Alice' } },
        'schema': BaseTypes.FilterSchema,
        'valid': {
          'field': 'name',
          'operator': 'eq',
          'value': 'Alice'
        }
      },
      {
        'schema': BaseTypes.PageSchema,
        'valid': {
          'items': [],
          'page': 1,
          'pageSize': 20,
          'total': 0
        }
      }
    ];

    for (const {
      invalid, schema, valid
    } of scenarios) {
      registry.register(schema);
      assert.equal(registry.validate(schema.$id, valid).length, 0);
      if (invalid) {
        assert.ok(registry.validate(schema.$id, invalid.data).length > 0);
      }
    }
  });

  void it('make*Schema() factories set $id and wrap body/data/items correctly', () => {
    const bodySchema = {
      'properties': { 'name': { 'type': 'string' } },
      'type': 'object'
    } as const;
    const response = BaseTypes.response(bodySchema, 'https://test.io/R');

    assert.equal(response.$id, 'https://test.io/R');
    assert.deepEqual(response.properties.body, bodySchema);

    const dataSchema = {
      'properties': { 'count': { 'type': 'number' } },
      'type': 'object'
    } as const;
    const result = BaseTypes.result(dataSchema, 'https://test.io/Res');

    assert.equal(result.$id, 'https://test.io/Res');
    assert.deepEqual(result.properties.data, dataSchema);

    const itemSchema = {
      'properties': { 'id': { 'type': 'number' } },
      'type': 'object'
    } as const;
    const page = BaseTypes.page(itemSchema, 'https://test.io/P');

    assert.equal(page.$id, 'https://test.io/P');
    assert.deepEqual(page.properties.items.items, itemSchema);
  });

  void it('make*Schema() validates via registry with $ref', () => {
    const registry = new SchemaRegistry();
    const IdBodySchema = {
      '$id': 'https://test.io/IdBody',
      'properties': { 'id': { 'type': 'number' } },
      'type': 'object'
    } as const;
    const responseSchema = BaseTypes.response(
      { '$ref': 'https://test.io/IdBody' } as const,
      'https://test.io/IdResponse'
    );

    registry.register([
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

    registry.register([
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

    registry.register(aPageSchema);
    assert.ok(registry.validate(aPageSchema.$id, { 'items': [] }).length > 0);
  });
});
