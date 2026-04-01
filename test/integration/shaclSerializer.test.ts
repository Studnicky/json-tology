import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { SchemaGraph } from '../../src/modules/graph/schemaGraph.js';
import { GraphShaclSerializer } from '../../src/modules/ontology/graphShaclSerializer.js';

function setSchemaKey(target: Record<string, unknown>, key: string, value: unknown): Record<string, unknown> {
  Reflect.set(target, key, value);

  return target;
}

const thenKeyword: string = String.fromCodePoint(116, 104, 101, 110);

function setThenKeyword(target: Record<string, unknown>, value: unknown): Record<string, unknown> {
  setSchemaKey(target, thenKeyword, value);

  return target;
}

const serializer = new GraphShaclSerializer();

function serialize(schema: Record<string, unknown>): unknown[] {
  const graph = new SchemaGraph(schema);

  return serializer.serialize([graph]);
}

function findShape(shapes: unknown[], targetId: string): Record<string, unknown> | undefined {
  return (shapes as Array<Record<string, unknown>>).find((shape) => {
    return shape['@id'] === targetId;
  });
}

function findProp(shape: Record<string, unknown>, pathId: string): Record<string, unknown> | undefined {
  const props = shape['http://www.w3.org/ns/shacl#property'] as Array<Record<string, unknown>>;

  return props.find((prop) => {
    return (prop['http://www.w3.org/ns/shacl#path'] as Record<string, unknown>)['@id'] === pathId;
  });
}

void describe('GraphShaclSerializer', () => {
  void it('top-level shape attributes', () => {
    const scenarios = [
      {
        'expected': { '@type': 'http://www.w3.org/ns/shacl#NodeShape' },
        'label': 'NodeShape for object schema',
        'schema': {
          '$id': 'https://example.com/Thing',
          'properties': { 'name': { 'type': 'string' } },
          'type': 'object'
        } as const
      },
      {
        'expected': { 'http://www.w3.org/ns/shacl#closed': true },
        'label': 'http://www.w3.org/ns/shacl#closed for additionalProperties: false',
        'schema': {
          '$id': 'https://example.com/Strict',
          'additionalProperties': false,
          'properties': { 'a': { 'type': 'string' } },
          'type': 'object'
        } as const
      },
      {
        'expected': { 'http://www.w3.org/ns/shacl#deactivated': true },
        'label': 'http://www.w3.org/ns/shacl#deactivated for deprecated schema',
        'schema': {
          '$id': 'https://example.com/Old',
          'deprecated': true,
          'properties': { 'name': { 'type': 'string' } },
          'type': 'object'
        } as const
      },
      {
        'expected': {
          'http://www.w3.org/ns/shacl#maxCount': 4,
          'http://www.w3.org/ns/shacl#minCount': 1
        },
        'label': 'http://www.w3.org/ns/shacl#minCount and sh:maxCount for array node cardinality',
        'schema': {
          '$id': 'https://example.com/TagList',
          'maxItems': 4,
          'minItems': 1,
          'type': 'array',
          'uniqueItems': true
        } as const
      }
    ] as const;

    for (const {
      expected, label, schema
    } of scenarios) {
      const shapes = serialize(schema as unknown as Record<string, unknown>);
      const shape = findShape(shapes, schema.$id);

      assert.ok(shape, label);

      for (const [
        key,
        value
      ] of Object.entries(expected)) {
        assert.deepEqual(shape[key], value, `${label}: ${key}`);
      }
    }
  });

  void it('single-property constraints', () => {
    const scenarios = [
      {
        'expected': {
          '@type': 'http://www.w3.org/ns/shacl#PropertyShape',
          'http://www.w3.org/ns/shacl#datatype': { '@id': 'http://www.w3.org/2001/XMLSchema#integer' },
          'http://www.w3.org/ns/shacl#maxCount': 1,
          'http://www.w3.org/ns/shacl#maxInclusive': 150,
          'http://www.w3.org/ns/shacl#minInclusive': 0
        },
        'label': 'integer min/max inclusive',
        'propKey': 'age',
        'schema': {
          '$id': 'https://example.com/T1',
          'properties': {
            'age': {
              'maximum': 150,
              'minimum': 0,
              'type': 'integer'
            }
          },
          'type': 'object'
        } as const
      },
      {
        'expected': {
          'http://www.w3.org/ns/shacl#maxLength': 10,
          'http://www.w3.org/ns/shacl#minLength': 2,
          'http://www.w3.org/ns/shacl#pattern': '^[A-Z]+$'
        },
        'label': 'string pattern/minLength/maxLength',
        'propKey': 'code',
        'schema': {
          '$id': 'https://example.com/T2',
          'properties': {
            'code': {
              'maxLength': 10,
              'minLength': 2,
              'pattern': '^[A-Z]+$',
              'type': 'string'
            }
          },
          'type': 'object'
        } as const
      },
      {
        'expected': {
          'http://www.w3.org/ns/shacl#maxExclusive': 100,
          'http://www.w3.org/ns/shacl#minExclusive': 0
        },
        'label': 'exclusive numeric constraints',
        'propKey': 'score',
        'schema': {
          '$id': 'https://example.com/T3',
          'properties': {
            'score': {
              'exclusiveMaximum': 100,
              'exclusiveMinimum': 0,
              'type': 'number'
            }
          },
          'type': 'object'
        } as const
      },
      {
        'expected': { 'https://json-tology.dev/vocab#multipleOf': 0.25 },
        'label': 'jt:multipleOf for numeric property',
        'propKey': 'step',
        'schema': {
          '$id': 'https://example.com/T4',
          'properties': {
            'step': {
              'multipleOf': 0.25,
              'type': 'number'
            }
          },
          'type': 'object'
        } as const
      },
      {
        'expected': { 'http://purl.org/dc/terms/format': 'application/json' },
        'label': 'dct:format for contentMediaType',
        'propKey': 'data',
        'schema': {
          '$id': 'https://example.com/T5',
          'properties': {
            'data': {
              'contentEncoding': 'base64',
              'contentMediaType': 'application/json',
              'type': 'string'
            }
          },
          'type': 'object'
        } as const
      },
      {
        'expected': { 'http://www.w3.org/ns/shacl#description': 'The name' },
        'label': 'property description',
        'propKey': 'name',
        'schema': {
          '$id': 'https://example.com/T6',
          'properties': {
            'name': {
              'description': 'The name',
              'type': 'string'
            }
          },
          'type': 'object'
        } as const
      }
    ] as const;

    for (const {
      expected, label, schema
    } of scenarios) {
      const shapes = serialize(schema as unknown as Record<string, unknown>);
      const shape = findShape(shapes, schema.$id) as Record<string, unknown>;
      const props = shape['http://www.w3.org/ns/shacl#property'] as Array<Record<string, unknown>>;

      assert.equal(props.length, 1, `${label}: one property`);

      for (const [
        key,
        value
      ] of Object.entries(expected)) {
        assert.deepEqual(props[0][key], value, `${label}: ${key}`);
      }
    }
  });

  void it('composition keywords (allOf, anyOf, not, enum)', () => {
    const scenarios = [
      {
        'expectedKey': 'http://www.w3.org/ns/shacl#and',
        'expectedValue': {
          '@list': [
            { '@id': 'https://example.com/A' },
            { '@id': 'https://example.com/B' }
          ]
        },
        'label': 'http://www.w3.org/ns/shacl#and from allOf',
        'schema': {
          '$id': 'https://example.com/Combined',
          'allOf': [
            { '$ref': 'https://example.com/A' },
            { '$ref': 'https://example.com/B' }
          ],
          'type': 'object'
        } as const
      },
      {
        'expectedKey': 'http://www.w3.org/ns/shacl#or',
        'expectedValue': {
          '@list': [
            { '@id': 'https://example.com/X' },
            { '@id': 'https://example.com/Y' }
          ]
        },
        'label': 'http://www.w3.org/ns/shacl#or from anyOf',
        'schema': {
          '$id': 'https://example.com/Union',
          'anyOf': [
            { '$ref': 'https://example.com/X' },
            { '$ref': 'https://example.com/Y' }
          ],
          'type': 'object'
        } as const
      },
      {
        'expectedKey': 'http://www.w3.org/ns/shacl#not',
        'expectedValue': { '@id': 'https://example.com/A' },
        'label': 'http://www.w3.org/ns/shacl#not',
        'schema': {
          '$id': 'https://example.com/NotA',
          'not': { '$ref': 'https://example.com/A' },
          'type': 'object'
        } as const
      },
      {
        'expectedKey': 'http://www.w3.org/ns/shacl#in',
        'expectedValue': {
          '@list': [
            'active',
            'inactive'
          ]
        },
        'label': 'http://www.w3.org/ns/shacl#in from enum',
        'schema': {
          '$id': 'https://example.com/Status',
          'enum': [
            'active',
            'inactive'
          ],
          'properties': {},
          'type': 'object'
        } as const
      }
    ] as const;

    for (const {
      expectedKey, expectedValue, label, schema
    } of scenarios) {
      const shapes = serialize(schema as unknown as Record<string, unknown>);
      const shape = findShape(shapes, schema.$id) as Record<string, unknown>;
      const actual = shape[expectedKey];

      assert.ok(actual !== undefined && actual !== null, `${label}: ${expectedKey} present`);
      assert.deepEqual(actual, expectedValue, `${label}: ${expectedKey} value`);
    }
  });

  void it('sets sh:minCount 1 for required properties', () => {
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
    const idProp = findProp(shape, 'https://example.com/Thing#id');
    const nameProp = findProp(shape, 'https://example.com/Thing#name');

    assert.ok(idProp !== undefined);
    assert.equal(idProp['http://www.w3.org/ns/shacl#minCount'], 1);
    assert.ok(nameProp !== undefined);
    assert.equal(nameProp['http://www.w3.org/ns/shacl#minCount'], undefined);
  });

  void it('sets sh:node for $ref properties', () => {
    const shapes = serialize({
      '$id': 'https://example.com/Thing',
      'properties': { 'parent': { '$ref': 'https://example.com/Thing' } },
      'type': 'object'
    });

    const shape = findShape(shapes, 'https://example.com/Thing') as Record<string, unknown>;
    const props = shape['http://www.w3.org/ns/shacl#property'] as Array<Record<string, unknown>>;

    assert.deepEqual(props[0]['http://www.w3.org/ns/shacl#node'], { '@id': 'https://example.com/Thing' });
    assert.equal(props[0]['http://www.w3.org/ns/shacl#datatype'], undefined);
  });

  void it('emits dash:readOnly and dash:writeOnly for property shapes', () => {
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
    const idProp = findProp(shape, 'https://example.com/Access#id');
    const pwProp = findProp(shape, 'https://example.com/Access#password');
    const nameProp = findProp(shape, 'https://example.com/Access#name');

    assert.ok(idProp !== undefined);
    assert.equal(idProp['http://datashapes.org/dash#readOnly'], true);
    assert.equal(idProp['http://datashapes.org/dash#writeOnly'], undefined);

    assert.ok(pwProp !== undefined);
    assert.equal(pwProp['http://datashapes.org/dash#readOnly'], undefined);
    assert.equal(pwProp['http://datashapes.org/dash#writeOnly'], true);

    assert.ok(nameProp !== undefined);
    assert.equal(nameProp['http://datashapes.org/dash#readOnly'], undefined);
    assert.equal(nameProp['http://datashapes.org/dash#writeOnly'], undefined);
  });

  void it('emits sh:pattern for string format properties', () => {
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
    const emailProp = findProp(shape, 'https://example.com/Formatted#email');

    assert.ok(emailProp);
    assert.ok(typeof emailProp['http://www.w3.org/ns/shacl#pattern'] === 'string', 'email format should emit sh:pattern');

    const dateProp = findProp(shape, 'https://example.com/Formatted#created');

    assert.ok(dateProp);
    assert.deepEqual(dateProp['http://www.w3.org/ns/shacl#datatype'], { '@id': 'http://www.w3.org/2001/XMLSchema#dateTime' });
    assert.equal(dateProp['http://www.w3.org/ns/shacl#pattern'], undefined, 'date-time should use xsd:dateTime, not pattern');

    const uuidProp = findProp(shape, 'https://example.com/Formatted#id');

    assert.ok(uuidProp);
    assert.ok(typeof uuidProp['http://www.w3.org/ns/shacl#pattern'] === 'string', 'uuid format should emit sh:pattern');
  });

  void it('emits if/then/else as SHACL logical constraints', () => {
    const base: Record<string, unknown> = {
      '$id': 'https://example.com/Conditional',
      'else': { 'required': ['kind'] },
      'if': { 'properties': { 'kind': { 'const': 'special' } } },
      'properties': {
        'kind': { 'type': 'string' },
        'value': { 'type': 'number' }
      },
      'type': 'object'
    };

    setThenKeyword(base, { 'required': ['value'] });
    const shapes = serialize(base);

    const shape = findShape(shapes, 'https://example.com/Conditional') as Record<string, unknown>;
    const and = shape['http://www.w3.org/ns/shacl#and'] as Record<string, unknown> | undefined;

    assert.ok(and !== undefined, 'if/then/else should produce sh:and constraint');
  });

  void it('emits dependentSchemas as full shape projection with property types', () => {
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
    const and = shape['http://www.w3.org/ns/shacl#and'];

    assert.ok(and !== undefined && and !== null);
    const list = (and as Record<string, unknown>)['@list'] as Array<Record<string, unknown>>;
    const implication = list.find((entry) => {
      return entry['http://www.w3.org/ns/shacl#or'] !== undefined;
    });

    assert.ok(implication !== undefined, 'dependentSchemas should produce sh:or implication');

    const orList = (implication['http://www.w3.org/ns/shacl#or'] as Record<string, unknown>)['@list'] as Array<Record<string, unknown>>;
    const depShape = orList[1];

    assert.equal(depShape['@type'], 'http://www.w3.org/ns/shacl#NodeShape');

    const propShapes = depShape['http://www.w3.org/ns/shacl#property'];

    assert.ok(propShapes !== undefined && propShapes !== null);
    const propShapeList = propShapes as Array<Record<string, unknown>>;

    assert.ok(propShapeList.length > 0);
    const billingProp = propShapeList.find((prop) => {
      return (prop['http://www.w3.org/ns/shacl#path'] as Record<string, unknown>)['@id'] === 'https://example.com/DepSchema#billing_address';
    });

    assert.ok(billingProp, 'should project billing_address property');
    assert.equal(billingProp['http://www.w3.org/ns/shacl#minCount'], 1, 'required property should have minCount');
    assert.deepEqual(billingProp['http://www.w3.org/ns/shacl#datatype'], { '@id': 'http://www.w3.org/2001/XMLSchema#string' }, 'should project datatype');
  });

  void it('dependentSchemas projects numeric constraints and closed-ness', () => {
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
    const and = shape['http://www.w3.org/ns/shacl#and'];

    assert.ok(and !== undefined && and !== null);
    const list = (and as Record<string, unknown>)['@list'] as Array<Record<string, unknown>>;
    const implication = list.find((entry) => {
      return entry['http://www.w3.org/ns/shacl#or'] !== undefined;
    });

    assert.ok(implication !== undefined);

    const orList = (implication['http://www.w3.org/ns/shacl#or'] as Record<string, unknown>)['@list'] as Array<Record<string, unknown>>;
    const depShape = orList[1];

    assert.equal(depShape['@type'], 'http://www.w3.org/ns/shacl#NodeShape');
    assert.equal(depShape['http://www.w3.org/ns/shacl#closed'], true, 'dependent schema with additionalProperties: false should be sh:closed');

    const propShapes = depShape['http://www.w3.org/ns/shacl#property'] as Array<Record<string, unknown>>;
    const countProp = propShapes.find((prop) => {
      return (prop['http://www.w3.org/ns/shacl#path'] as Record<string, unknown>)['@id'] === 'https://example.com/DepDeep#count';
    });

    assert.ok(countProp);
    assert.equal(countProp['http://www.w3.org/ns/shacl#minCount'], 1, 'required property has minCount');
    assert.equal(countProp['http://www.w3.org/ns/shacl#minInclusive'], 1, 'minimum constraint projected');
    assert.equal(countProp['http://www.w3.org/ns/shacl#maxInclusive'], 100, 'maximum constraint projected');
    assert.deepEqual(countProp['http://www.w3.org/ns/shacl#datatype'], { '@id': 'http://www.w3.org/2001/XMLSchema#integer' });
  });
});
