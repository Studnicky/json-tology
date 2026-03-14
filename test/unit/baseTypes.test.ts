import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import {
  BaseTypes, makePageSchema, makeResponseSchema, makeResultSchema
} from '../../src/types/BaseTypes.js';
import { SchemaRegistry } from '../../src/modules/registry/SchemaRegistry.js';

describe('BaseTypes.Schema', () => {
  it('has $id, $defs with all expected types', () => {
    assert.ok(BaseTypes.Schema.$id);
    assert.ok(BaseTypes.Schema.$defs);
    const defs = BaseTypes.Schema.$defs;

    assert.ok('Pagination' in defs);
    assert.ok('Filter' in defs);
    assert.ok('Page' in defs);
    assert.ok('SortOrder' in defs);
    assert.ok('Cursor' in defs);
  });
});

describe('BaseTypes standalone schemas', () => {
  it('all standalone schemas have $id', () => {
    assert.ok(BaseTypes.ResponseSchema.$id);
    assert.ok(BaseTypes.ResultSchema.$id);
    assert.ok(BaseTypes.PaginationSchema.$id);
    assert.ok(BaseTypes.FilterSchema.$id);
    assert.ok(BaseTypes.PageSchema.$id);
  });
});

describe('BaseTypes schema validation', () => {
  const registry = new SchemaRegistry();

  it('validates ResponseSchema and rejects invalid', () => {
    registry.register(BaseTypes.ResponseSchema);
    assert.equal(registry.validate(BaseTypes.ResponseSchema.$id, { 'success': true }).length, 0);
    assert.ok(registry.validate(BaseTypes.ResponseSchema.$id, { 'success': 'yes' }).length > 0);
  });

  it('validates ResultSchema', () => {
    registry.register(BaseTypes.ResultSchema);
    const errors = registry.validate(BaseTypes.ResultSchema.$id, {
      'errorCode': 'ERR_001',
      'success': false
    });

    assert.equal(errors.length, 0);
  });

  it('validates PaginationSchema and rejects invalid pageSize', () => {
    registry.register(BaseTypes.PaginationSchema);
    assert.equal(registry.validate(BaseTypes.PaginationSchema.$id, {
      'page': 2,
      'pageSize': 10
    }).length, 0);
    assert.ok(registry.validate(BaseTypes.PaginationSchema.$id, { 'pageSize': 0 }).length > 0);
  });

  it('validates FilterSchema and rejects missing required fields', () => {
    registry.register(BaseTypes.FilterSchema);
    assert.equal(registry.validate(BaseTypes.FilterSchema.$id, {
      'field': 'name',
      'operator': 'eq',
      'value': 'Alice'
    }).length, 0);
    assert.ok(registry.validate(BaseTypes.FilterSchema.$id, { 'value': 'Alice' }).length > 0);
  });

  it('validates PageSchema', () => {
    registry.register(BaseTypes.PageSchema);
    const errors = registry.validate(BaseTypes.PageSchema.$id, {
      'items': [],
      'page': 1,
      'pageSize': 20,
      'total': 0
    });

    assert.equal(errors.length, 0);
  });
});

describe('makeResponseSchema()', () => {
  it('creates schema with correct $id and wraps body', () => {
    const schema = makeResponseSchema({ 'type': 'object' } as const, 'https://test.io/MyResponse');

    assert.equal(schema.$id, 'https://test.io/MyResponse');

    const bodySchema = {
      'properties': { 'name': { 'type': 'string' } },
      'type': 'object'
    } as const;
    const schema2 = makeResponseSchema(bodySchema, 'https://test.io/R');

    assert.deepEqual(schema2.properties.body, bodySchema);
  });

  it('validates via registry with $ref body', () => {
    const registry = new SchemaRegistry();
    const IdBodySchema = {
      '$id': 'https://test.io/IdBody',
      'properties': { 'id': { 'type': 'number' } },
      'type': 'object'
    } as const;
    const schema = makeResponseSchema(
      { '$ref': 'https://test.io/IdBody' } as const,
      'https://test.io/IdResponse'
    );

    registry.register([
      IdBodySchema,
      schema
    ]);
    const errors = registry.validate(schema.$id, {
      'body': { 'id': 1 },
      'success': true
    });

    assert.equal(errors.length, 0);
  });
});

describe('makeResultSchema()', () => {
  it('creates schema with correct $id and wraps data', () => {
    const schema = makeResultSchema({ 'type': 'object' } as const, 'https://test.io/MyResult');

    assert.equal(schema.$id, 'https://test.io/MyResult');

    const dataSchema = {
      'properties': { 'count': { 'type': 'number' } },
      'type': 'object'
    } as const;
    const schema2 = makeResultSchema(dataSchema, 'https://test.io/R');

    assert.deepEqual(schema2.properties.data, dataSchema);
  });
});

describe('makePageSchema()', () => {
  it('creates schema with correct $id and uses item schema', () => {
    const schema = makePageSchema({ 'type': 'object' } as const, 'https://test.io/MyPage');

    assert.equal(schema.$id, 'https://test.io/MyPage');

    const itemSchema = {
      'properties': { 'id': { 'type': 'number' } },
      'type': 'object'
    } as const;
    const schema2 = makePageSchema(itemSchema, 'https://test.io/P');

    assert.deepEqual(schema2.properties.items.items, itemSchema);
  });

  it('validates via registry with $ref items', () => {
    const registry = new SchemaRegistry();
    const NameItemSchema = {
      '$id': 'https://test.io/NameItem',
      'properties': { 'name': { 'type': 'string' } },
      'type': 'object'
    } as const;
    const schema = makePageSchema(
      { '$ref': 'https://test.io/NameItem' } as const,
      'https://test.io/NamePage'
    );

    registry.register([
      NameItemSchema,
      schema
    ]);
    const errors = registry.validate(schema.$id, {
      'items': [{ 'name': 'Alice' }],
      'page': 1,
      'pageSize': 20,
      'total': 1
    });

    assert.equal(errors.length, 0);
  });

  it('rejects page missing required fields', () => {
    const registry = new SchemaRegistry();
    const schema = makePageSchema({ 'type': 'object' } as const, 'https://test.io/APage');

    registry.register(schema);
    const errors = registry.validate(schema.$id, { 'items': [] });

    assert.ok(errors.length > 0);
  });
});
