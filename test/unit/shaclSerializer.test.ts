import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { SchemaGraph } from '../../src/modules/graph/SchemaGraph.js';
import { GraphShaclSerializer } from '../../src/modules/ontology/GraphShaclSerializer.js';

const serializer = new GraphShaclSerializer();

function serialize(schema: Record<string, unknown>): unknown[] {
  const graph = new SchemaGraph(schema);

  return serializer.serialize([graph]);
}

function findShape(shapes: unknown[], id: string): Record<string, unknown> | undefined {
  return (shapes as Array<Record<string, unknown>>).find((s) => {
    return s['@id'] === id;
  });
}

describe('GraphShaclSerializer', () => {
  it('produces sh:NodeShape for object schema', () => {
    const shapes = serialize({
      '$id': 'https://example.com/Thing',
      'properties': { 'name': { 'type': 'string' } },
      'type': 'object'
    });

    const shape = findShape(shapes, 'https://example.com/Thing');

    assert.ok(shape);
    assert.equal(shape['@type'], 'sh:NodeShape');
  });

  it('produces sh:PropertyShape with correct constraints', () => {
    const shapes = serialize({
      '$id': 'https://example.com/Thing',
      'properties': {
        'age': {
          'maximum': 150,
          'minimum': 0,
          'type': 'integer'
        }
      },
      'type': 'object'
    });

    const shape = findShape(shapes, 'https://example.com/Thing') as Record<string, unknown>;
    const props = shape['sh:property'] as Array<Record<string, unknown>>;

    assert.equal(props.length, 1);
    assert.equal(props[0]['@type'], 'sh:PropertyShape');
    assert.deepEqual(props[0]['sh:datatype'], { '@id': 'xsd:integer' });
    assert.equal(props[0]['sh:minInclusive'], 0);
    assert.equal(props[0]['sh:maxInclusive'], 150);
    assert.equal(props[0]['sh:maxCount'], 1);
  });

  it('sets sh:minCount 1 for required properties', () => {
    const shapes = serialize({
      '$id': 'https://example.com/Thing',
      'properties': {
        'id': { 'type': 'string' },
        'name': { 'type': 'string' }
      },
      'required': ['id'],
      'type': 'object'
    });

    const shape = findShape(shapes, 'https://example.com/Thing') as Record<string, unknown>;
    const props = shape['sh:property'] as Array<Record<string, unknown>>;
    const idProp = props.find((p) => {
      return (p['sh:path'] as Record<string, unknown>)['@id'] === 'https://example.com/Thing#id';
    });
    const nameProp = props.find((p) => {
      return (p['sh:path'] as Record<string, unknown>)['@id'] === 'https://example.com/Thing#name';
    });

    assert.equal(idProp!['sh:minCount'], 1);
    assert.equal(nameProp!['sh:minCount'], undefined);
  });

  it('sets sh:node for $ref properties', () => {
    const shapes = serialize({
      '$id': 'https://example.com/Thing',
      'properties': { 'parent': { '$ref': 'https://example.com/Thing' } },
      'type': 'object'
    });

    const shape = findShape(shapes, 'https://example.com/Thing') as Record<string, unknown>;
    const props = shape['sh:property'] as Array<Record<string, unknown>>;

    assert.deepEqual(props[0]['sh:node'], { '@id': 'https://example.com/Thing' });
    assert.equal(props[0]['sh:datatype'], undefined);
  });

  it('sets sh:closed for additionalProperties: false', () => {
    const shapes = serialize({
      '$id': 'https://example.com/Strict',
      'additionalProperties': false,
      'properties': { 'a': { 'type': 'string' } },
      'type': 'object'
    });

    const shape = findShape(shapes, 'https://example.com/Strict') as Record<string, unknown>;

    assert.equal(shape['sh:closed'], true);
  });

  it('produces sh:and from allOf', () => {
    const shapes = serialize({
      '$id': 'https://example.com/Combined',
      'allOf': [
        { '$ref': 'https://example.com/A' },
        { '$ref': 'https://example.com/B' }
      ],
      'type': 'object'
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
      '$id': 'https://example.com/Status',
      'enum': [
        'active',
        'inactive'
      ],
      'properties': {},
      'type': 'object'
    });

    const shape = findShape(shapes, 'https://example.com/Status') as Record<string, unknown>;
    const inList = shape['sh:in'] as Record<string, unknown>;

    assert.ok(inList);
    assert.deepEqual(inList['@list'], [
      'active',
      'inactive'
    ]);
  });

  it('includes string constraints (pattern, minLength, maxLength)', () => {
    const shapes = serialize({
      '$id': 'https://example.com/T',
      'properties': {
        'code': {
          'maxLength': 10,
          'minLength': 2,
          'pattern': '^[A-Z]+$',
          'type': 'string'
        }
      },
      'type': 'object'
    });

    const shape = findShape(shapes, 'https://example.com/T') as Record<string, unknown>;
    const props = shape['sh:property'] as Array<Record<string, unknown>>;

    assert.equal(props[0]['sh:pattern'], '^[A-Z]+$');
    assert.equal(props[0]['sh:minLength'], 2);
    assert.equal(props[0]['sh:maxLength'], 10);
  });

  it('includes exclusive numeric constraints', () => {
    const shapes = serialize({
      '$id': 'https://example.com/T',
      'properties': {
        'score': {
          'exclusiveMaximum': 100,
          'exclusiveMinimum': 0,
          'type': 'number'
        }
      },
      'type': 'object'
    });

    const shape = findShape(shapes, 'https://example.com/T') as Record<string, unknown>;
    const props = shape['sh:property'] as Array<Record<string, unknown>>;

    assert.equal(props[0]['sh:minExclusive'], 0);
    assert.equal(props[0]['sh:maxExclusive'], 100);
  });

  it('produces sh:or from anyOf', () => {
    const shapes = serialize({
      '$id': 'https://example.com/Union',
      'anyOf': [
        { '$ref': 'https://example.com/X' },
        { '$ref': 'https://example.com/Y' }
      ],
      'type': 'object'
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
      '$id': 'https://example.com/NotA',
      'not': { '$ref': 'https://example.com/A' },
      'type': 'object'
    });

    const shape = findShape(shapes, 'https://example.com/NotA') as Record<string, unknown>;

    assert.deepEqual(shape['sh:not'], { '@id': 'https://example.com/A' });
  });

  it('emits sh:deactivated for deprecated schemas', () => {
    const shapes = serialize({
      '$id': 'https://example.com/Old',
      'deprecated': true,
      'properties': { 'name': { 'type': 'string' } },
      'type': 'object'
    });

    const shape = findShape(shapes, 'https://example.com/Old') as Record<string, unknown>;

    assert.equal(shape['sh:deactivated'], true);
  });

  it('emits dependentSchemas as full shape projection with property types', () => {
    const shapes = serialize({
      '$id': 'https://example.com/DepSchema',
      'dependentSchemas': {
        'credit_card': {
          'properties': { 'billing_address': { 'type': 'string' } },
          'required': ['billing_address']
        }
      },
      'properties': {
        'billing_address': { 'type': 'string' },
        'credit_card': { 'type': 'string' }
      },
      'type': 'object'
    });

    const shape = findShape(shapes, 'https://example.com/DepSchema') as Record<string, unknown>;
    const and = shape['sh:and'] as Record<string, unknown>;

    assert.ok(and);
    const list = and['@list'] as Array<Record<string, unknown>>;
    const implication = list.find((entry: any) => {
      return entry['sh:or'] !== undefined;
    }) as Record<string, unknown>;

    assert.ok(implication, 'dependentSchemas should produce sh:or implication');

    // The dependent shape should be a full sh:NodeShape with property constraints
    const orList = (implication['sh:or'] as Record<string, unknown>)['@list'] as Array<Record<string, unknown>>;
    const depShape = orList[1];

    assert.equal(depShape['@type'], 'sh:NodeShape');

    // Should have property shapes with both minCount and datatype
    const propShapes = depShape['sh:property'] as Array<Record<string, unknown>>;

    assert.ok(propShapes);
    assert.ok(propShapes.length > 0);
    const billingProp = propShapes.find((p) => {
      return (p['sh:path'] as Record<string, unknown>)['@id'] === 'https://example.com/DepSchema#billing_address';
    });

    assert.ok(billingProp, 'should project billing_address property');
    assert.equal(billingProp['sh:minCount'], 1, 'required property should have minCount');
    assert.deepEqual(billingProp['sh:datatype'], { '@id': 'xsd:string' }, 'should project datatype');
  });

  it('emits if/then/else as SHACL logical constraints', () => {
    const shapes = serialize({
      '$id': 'https://example.com/Conditional',
      'else': { 'required': ['kind'] },
      'if': { 'properties': { 'kind': { 'const': 'special' } } },
      'properties': {
        'kind': { 'type': 'string' },
        'value': { 'type': 'number' }
      },
      'then': { 'required': ['value'] },
      'type': 'object'
    });

    const shape = findShape(shapes, 'https://example.com/Conditional') as Record<string, unknown>;
    // Should have some logical constraint from if/then/else
    const and = shape['sh:and'] as Record<string, unknown> | undefined;

    assert.ok(and, 'if/then/else should produce sh:and constraint');
  });

  it('emits sh:pattern for string format properties', () => {
    const shapes = serialize({
      '$id': 'https://example.com/Formatted',
      'properties': {
        'created': {
          'format': 'date-time',
          'type': 'string'
        },
        'email': {
          'format': 'email',
          'type': 'string'
        },
        'id': {
          'format': 'uuid',
          'type': 'string'
        }
      },
      'type': 'object'
    });

    const shape = findShape(shapes, 'https://example.com/Formatted') as Record<string, unknown>;
    const props = shape['sh:property'] as Array<Record<string, unknown>>;

    const emailProp = props.find((p) => {
      return (p['sh:path'] as Record<string, unknown>)['@id'] === 'https://example.com/Formatted#email';
    });

    assert.ok(emailProp);
    assert.ok(emailProp['sh:pattern'], 'email format should emit sh:pattern');

    // date-time maps to xsd:dateTime — no pattern needed since XSD datatype handles it
    const dateProp = props.find((p) => {
      return (p['sh:path'] as Record<string, unknown>)['@id'] === 'https://example.com/Formatted#created';
    });

    assert.ok(dateProp);
    assert.deepEqual(dateProp['sh:datatype'], { '@id': 'xsd:dateTime' });
    assert.equal(dateProp['sh:pattern'], undefined, 'date-time should use xsd:dateTime, not pattern');

    const uuidProp = props.find((p) => {
      return (p['sh:path'] as Record<string, unknown>)['@id'] === 'https://example.com/Formatted#id';
    });

    assert.ok(uuidProp);
    assert.ok(uuidProp['sh:pattern'], 'uuid format should emit sh:pattern');
  });

  it('emits dash:readOnly and dash:writeOnly for property shapes', () => {
    const shapes = serialize({
      '$id': 'https://example.com/Access',
      'properties': {
        'id': {
          'readOnly': true,
          'type': 'string'
        },
        'name': { 'type': 'string' },
        'password': {
          'type': 'string',
          'writeOnly': true
        }
      },
      'type': 'object'
    });

    const shape = findShape(shapes, 'https://example.com/Access') as Record<string, unknown>;
    const props = shape['sh:property'] as Array<Record<string, unknown>>;

    const idProp = props.find((p) => {
      return (p['sh:path'] as Record<string, unknown>)['@id'] === 'https://example.com/Access#id';
    });

    assert.equal(idProp!['dash:readOnly'], true);
    assert.equal(idProp!['dash:writeOnly'], undefined);

    const pwProp = props.find((p) => {
      return (p['sh:path'] as Record<string, unknown>)['@id'] === 'https://example.com/Access#password';
    });

    assert.equal(pwProp!['dash:readOnly'], undefined);
    assert.equal(pwProp!['dash:writeOnly'], true);

    const nameProp = props.find((p) => {
      return (p['sh:path'] as Record<string, unknown>)['@id'] === 'https://example.com/Access#name';
    });

    assert.equal(nameProp!['dash:readOnly'], undefined);
    assert.equal(nameProp!['dash:writeOnly'], undefined);
  });

  it('emits dct:format for contentMediaType', () => {
    const shapes = serialize({
      '$id': 'https://example.com/Media',
      'properties': {
        'data': {
          'contentEncoding': 'base64',
          'contentMediaType': 'application/json',
          'type': 'string'
        }
      },
      'type': 'object'
    });

    const shape = findShape(shapes, 'https://example.com/Media') as Record<string, unknown>;
    const props = shape['sh:property'] as Array<Record<string, unknown>>;

    const dataProp = props.find((p) => {
      return (p['sh:path'] as Record<string, unknown>)['@id'] === 'https://example.com/Media#data';
    });

    assert.equal(dataProp!['dct:format'], 'application/json');
  });

  it('dependentSchemas projects numeric constraints and closed-ness', () => {
    const shapes = serialize({
      '$id': 'https://example.com/DepDeep',
      'dependentSchemas': {
        'mode': {
          'additionalProperties': false,
          'properties': {
            'count': {
              'maximum': 100,
              'minimum': 1,
              'type': 'integer'
            }
          },
          'required': ['count']
        }
      },
      'properties': {
        'count': { 'type': 'integer' },
        'mode': { 'type': 'string' }
      },
      'type': 'object'
    });

    const shape = findShape(shapes, 'https://example.com/DepDeep') as Record<string, unknown>;
    const and = shape['sh:and'] as Record<string, unknown>;

    assert.ok(and);
    const list = and['@list'] as Array<Record<string, unknown>>;
    const implication = list.find((entry: any) => {
      return entry['sh:or'] !== undefined;
    }) as Record<string, unknown>;

    assert.ok(implication);

    const orList = (implication['sh:or'] as Record<string, unknown>)['@list'] as Array<Record<string, unknown>>;
    const depShape = orList[1];

    assert.equal(depShape['@type'], 'sh:NodeShape');
    assert.equal(depShape['sh:closed'], true, 'dependent schema with additionalProperties: false should be sh:closed');

    const propShapes = depShape['sh:property'] as Array<Record<string, unknown>>;
    const countProp = propShapes.find((p) => {
      return (p['sh:path'] as Record<string, unknown>)['@id'] === 'https://example.com/DepDeep#count';
    });

    assert.ok(countProp);
    assert.equal(countProp['sh:minCount'], 1, 'required property has minCount');
    assert.equal(countProp['sh:minInclusive'], 1, 'minimum constraint projected');
    assert.equal(countProp['sh:maxInclusive'], 100, 'maximum constraint projected');
    assert.deepEqual(countProp['sh:datatype'], { '@id': 'xsd:integer' });
  });

  it('property description is included', () => {
    const shapes = serialize({
      '$id': 'https://example.com/T',
      'properties': {
        'name': {
          'description': 'The name',
          'type': 'string'
        }
      },
      'type': 'object'
    });

    const shape = findShape(shapes, 'https://example.com/T') as Record<string, unknown>;
    const props = shape['sh:property'] as Array<Record<string, unknown>>;

    assert.equal(props[0]['sh:description'], 'The name');
  });
});
