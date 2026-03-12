import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SchemaGraph } from '../../src/schema/SchemaGraph.js';
import { GraphShaclSerializer } from '../../src/ontology/GraphShaclSerializer.js';

const serializer = new GraphShaclSerializer();

function serialize(schema: Record<string, unknown>): unknown[] {
  const graph = new SchemaGraph(schema);

  return serializer.serialize([graph]);
}

function findShape(shapes: unknown[], id: string): Record<string, unknown> | undefined {
  return (shapes as Record<string, unknown>[]).find((s) => s['@id'] === id);
}

describe('GraphShaclSerializer', () => {
  it('produces sh:NodeShape for object schema', () => {
    const shapes = serialize({
      $id: 'https://example.com/Thing',
      type: 'object',
      properties: {
        name: { type: 'string' }
      }
    });

    const shape = findShape(shapes, 'https://example.com/Thing');

    assert.ok(shape);
    assert.equal(shape['@type'], 'sh:NodeShape');
  });

  it('produces sh:PropertyShape with correct constraints', () => {
    const shapes = serialize({
      $id: 'https://example.com/Thing',
      type: 'object',
      properties: {
        age: { type: 'integer', minimum: 0, maximum: 150 }
      }
    });

    const shape = findShape(shapes, 'https://example.com/Thing') as Record<string, unknown>;
    const props = shape['sh:property'] as Record<string, unknown>[];

    assert.equal(props.length, 1);
    assert.equal(props[0]['@type'], 'sh:PropertyShape');
    assert.deepEqual(props[0]['sh:datatype'], { '@id': 'xsd:integer' });
    assert.equal(props[0]['sh:minInclusive'], 0);
    assert.equal(props[0]['sh:maxInclusive'], 150);
    assert.equal(props[0]['sh:maxCount'], 1);
  });

  it('sets sh:minCount 1 for required properties', () => {
    const shapes = serialize({
      $id: 'https://example.com/Thing',
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' }
      },
      required: ['id']
    });

    const shape = findShape(shapes, 'https://example.com/Thing') as Record<string, unknown>;
    const props = shape['sh:property'] as Record<string, unknown>[];
    const idProp = props.find((p) =>
      (p['sh:path'] as Record<string, unknown>)['@id'] === 'https://example.com/Thing#id'
    );
    const nameProp = props.find((p) =>
      (p['sh:path'] as Record<string, unknown>)['@id'] === 'https://example.com/Thing#name'
    );

    assert.equal(idProp!['sh:minCount'], 1);
    assert.equal(nameProp!['sh:minCount'], undefined);
  });

  it('sets sh:node for $ref properties', () => {
    const shapes = serialize({
      $id: 'https://example.com/Thing',
      type: 'object',
      properties: {
        parent: { $ref: 'https://example.com/Thing' }
      }
    });

    const shape = findShape(shapes, 'https://example.com/Thing') as Record<string, unknown>;
    const props = shape['sh:property'] as Record<string, unknown>[];

    assert.deepEqual(props[0]['sh:node'], { '@id': 'https://example.com/Thing' });
    assert.equal(props[0]['sh:datatype'], undefined);
  });

  it('sets sh:closed for additionalProperties: false', () => {
    const shapes = serialize({
      $id: 'https://example.com/Strict',
      type: 'object',
      properties: { a: { type: 'string' } },
      additionalProperties: false
    });

    const shape = findShape(shapes, 'https://example.com/Strict') as Record<string, unknown>;

    assert.equal(shape['sh:closed'], true);
  });

  it('produces sh:and from allOf', () => {
    const shapes = serialize({
      $id: 'https://example.com/Combined',
      type: 'object',
      allOf: [
        { $ref: 'https://example.com/A' },
        { $ref: 'https://example.com/B' }
      ]
    });

    const shape = findShape(shapes, 'https://example.com/Combined') as Record<string, unknown>;
    const and = shape['sh:and'] as Record<string, unknown>;

    assert.ok(and);
    assert.deepEqual(and['@list'], [
      { '@id': 'https://example.com/A' },
      { '@id': 'https://example.com/B' }
    ]);
  });

  it('produces sh:in from enum', () => {
    const shapes = serialize({
      $id: 'https://example.com/Status',
      type: 'object',
      properties: {},
      enum: ['active', 'inactive']
    });

    const shape = findShape(shapes, 'https://example.com/Status') as Record<string, unknown>;
    const inList = shape['sh:in'] as Record<string, unknown>;

    assert.ok(inList);
    assert.deepEqual(inList['@list'], ['active', 'inactive']);
  });

  it('includes string constraints (pattern, minLength, maxLength)', () => {
    const shapes = serialize({
      $id: 'https://example.com/T',
      type: 'object',
      properties: {
        code: { type: 'string', pattern: '^[A-Z]+$', minLength: 2, maxLength: 10 }
      }
    });

    const shape = findShape(shapes, 'https://example.com/T') as Record<string, unknown>;
    const props = shape['sh:property'] as Record<string, unknown>[];

    assert.equal(props[0]['sh:pattern'], '^[A-Z]+$');
    assert.equal(props[0]['sh:minLength'], 2);
    assert.equal(props[0]['sh:maxLength'], 10);
  });

  it('includes exclusive numeric constraints', () => {
    const shapes = serialize({
      $id: 'https://example.com/T',
      type: 'object',
      properties: {
        score: { type: 'number', exclusiveMinimum: 0, exclusiveMaximum: 100 }
      }
    });

    const shape = findShape(shapes, 'https://example.com/T') as Record<string, unknown>;
    const props = shape['sh:property'] as Record<string, unknown>[];

    assert.equal(props[0]['sh:minExclusive'], 0);
    assert.equal(props[0]['sh:maxExclusive'], 100);
  });

  it('produces sh:or from anyOf', () => {
    const shapes = serialize({
      $id: 'https://example.com/Union',
      type: 'object',
      anyOf: [
        { $ref: 'https://example.com/X' },
        { $ref: 'https://example.com/Y' }
      ]
    });

    const shape = findShape(shapes, 'https://example.com/Union') as Record<string, unknown>;
    const or = shape['sh:or'] as Record<string, unknown>;

    assert.ok(or);
    assert.deepEqual(or['@list'], [
      { '@id': 'https://example.com/X' },
      { '@id': 'https://example.com/Y' }
    ]);
  });

  it('produces sh:not', () => {
    const shapes = serialize({
      $id: 'https://example.com/NotA',
      type: 'object',
      not: { $ref: 'https://example.com/A' }
    });

    const shape = findShape(shapes, 'https://example.com/NotA') as Record<string, unknown>;

    assert.deepEqual(shape['sh:not'], { '@id': 'https://example.com/A' });
  });

  it('property description is included', () => {
    const shapes = serialize({
      $id: 'https://example.com/T',
      type: 'object',
      properties: {
        name: { type: 'string', description: 'The name' }
      }
    });

    const shape = findShape(shapes, 'https://example.com/T') as Record<string, unknown>;
    const props = shape['sh:property'] as Record<string, unknown>[];

    assert.equal(props[0]['sh:description'], 'The name');
  });
});
