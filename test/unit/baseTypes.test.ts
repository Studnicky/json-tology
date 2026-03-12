import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BaseTypes, makeResponseSchema, makeResultSchema, makePageSchema } from '../../src/types/BaseTypes.js';
import { SchemaRegistry } from '../../src/schema/SchemaRegistry.js';

describe('BaseTypes.Schema', () => {
  it('has $id and $defs', () => {
    assert.ok(BaseTypes.Schema.$id);
    assert.ok(BaseTypes.Schema.$defs);
  });

  it('includes all new types in $defs', () => {
    const defs = BaseTypes.Schema.$defs;
    assert.ok('Pagination' in defs);
    assert.ok('Filter' in defs);
    assert.ok('Page' in defs);
    assert.ok('SortOrder' in defs);
    assert.ok('Cursor' in defs);
  });
});

describe('BaseTypes standalone schemas', () => {
  it('ResponseSchema has $id', () => {
    assert.ok(BaseTypes.ResponseSchema.$id);
  });

  it('ResultSchema has $id', () => {
    assert.ok(BaseTypes.ResultSchema.$id);
  });

  it('PaginationSchema has $id', () => {
    assert.ok(BaseTypes.PaginationSchema.$id);
  });

  it('FilterSchema has $id', () => {
    assert.ok(BaseTypes.FilterSchema.$id);
  });

  it('PageSchema has $id', () => {
    assert.ok(BaseTypes.PageSchema.$id);
  });
});

describe('BaseTypes schema validation', () => {
  const registry = new SchemaRegistry();

  it('validates ResponseSchema', () => {
    registry.register(BaseTypes.ResponseSchema);
    const errors = registry.validate(BaseTypes.ResponseSchema.$id, { success: true });
    assert.equal(errors.length, 0);
  });

  it('rejects invalid ResponseSchema', () => {
    const errors = registry.validate(BaseTypes.ResponseSchema.$id, { success: 'yes' });
    assert.ok(errors.length > 0);
  });

  it('validates ResultSchema', () => {
    registry.register(BaseTypes.ResultSchema);
    const errors = registry.validate(BaseTypes.ResultSchema.$id, { success: false, errorCode: 'ERR_001' });
    assert.equal(errors.length, 0);
  });

  it('validates PaginationSchema', () => {
    registry.register(BaseTypes.PaginationSchema);
    const errors = registry.validate(BaseTypes.PaginationSchema.$id, { page: 2, pageSize: 10 });
    assert.equal(errors.length, 0);
  });

  it('rejects invalid pageSize in PaginationSchema', () => {
    const errors = registry.validate(BaseTypes.PaginationSchema.$id, { pageSize: 0 });
    assert.ok(errors.length > 0);
  });

  it('validates FilterSchema', () => {
    registry.register(BaseTypes.FilterSchema);
    const errors = registry.validate(BaseTypes.FilterSchema.$id, { field: 'name', operator: 'eq', value: 'Alice' });
    assert.equal(errors.length, 0);
  });

  it('rejects FilterSchema without required fields', () => {
    const errors = registry.validate(BaseTypes.FilterSchema.$id, { value: 'Alice' });
    assert.ok(errors.length > 0);
  });

  it('validates PageSchema', () => {
    registry.register(BaseTypes.PageSchema);
    const errors = registry.validate(BaseTypes.PageSchema.$id, {
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });
    assert.equal(errors.length, 0);
  });
});

describe('makeResponseSchema()', () => {
  it('creates a schema with correct $id', () => {
    const schema = makeResponseSchema({ type: 'object' } as const, 'https://test.io/MyResponse');
    assert.equal(schema.$id, 'https://test.io/MyResponse');
  });

  it('wraps body with provided schema', () => {
    const bodySchema = { type: 'object', properties: { name: { type: 'string' } } } as const;
    const schema = makeResponseSchema(bodySchema, 'https://test.io/R');
    assert.deepEqual(schema.properties.body, bodySchema);
  });

  it('validates via registry', () => {
    const registry = new SchemaRegistry();
    const IdBodySchema = {
      '$id': 'https://test.io/IdBody',
      'type': 'object',
      'properties': { 'id': { 'type': 'number' } },
    } as const;
    const schema = makeResponseSchema(
      { '$ref': 'https://test.io/IdBody' } as const,
      'https://test.io/IdResponse',
    );
    registry.register([IdBodySchema, schema]);
    const errors = registry.validate(schema.$id, { success: true, body: { id: 1 } });
    assert.equal(errors.length, 0);
  });
});

describe('makeResultSchema()', () => {
  it('creates a schema with correct $id', () => {
    const schema = makeResultSchema({ type: 'object' } as const, 'https://test.io/MyResult');
    assert.equal(schema.$id, 'https://test.io/MyResult');
  });

  it('wraps data with provided schema', () => {
    const dataSchema = { type: 'object', properties: { count: { type: 'number' } } } as const;
    const schema = makeResultSchema(dataSchema, 'https://test.io/R');
    assert.deepEqual(schema.properties.data, dataSchema);
  });
});

describe('makePageSchema()', () => {
  it('creates a schema with correct $id', () => {
    const schema = makePageSchema({ type: 'object' } as const, 'https://test.io/MyPage');
    assert.equal(schema.$id, 'https://test.io/MyPage');
  });

  it('uses provided item schema for items array', () => {
    const itemSchema = { type: 'object', properties: { id: { type: 'number' } } } as const;
    const schema = makePageSchema(itemSchema, 'https://test.io/P');
    assert.deepEqual(schema.properties.items.items, itemSchema);
  });

  it('validates via registry', () => {
    const registry = new SchemaRegistry();
    const NameItemSchema = {
      '$id': 'https://test.io/NameItem',
      'type': 'object',
      'properties': { 'name': { 'type': 'string' } },
    } as const;
    const schema = makePageSchema(
      { '$ref': 'https://test.io/NameItem' } as const,
      'https://test.io/NamePage',
    );
    registry.register([NameItemSchema, schema]);
    const errors = registry.validate(schema.$id, {
      items: [{ name: 'Alice' }],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    assert.equal(errors.length, 0);
  });

  it('rejects page missing required fields', () => {
    const registry = new SchemaRegistry();
    const schema = makePageSchema({ type: 'object' } as const, 'https://test.io/APage');
    registry.register(schema);
    const errors = registry.validate(schema.$id, { items: [] });
    assert.ok(errors.length > 0);
  });
});
