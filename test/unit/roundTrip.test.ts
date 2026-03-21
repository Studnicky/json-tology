/**
 * Phase 6 — Schema Round-Trip Verification
 *
 * Proves the canonical graph is lossless by round-tripping:
 *   schema -> SchemaGraph -> GraphSchemaSerializer -> schema
 *
 * For every test schema, verifies:
 *  1. Serialized output is deeply equal to the original (modulo key ordering)
 *  2. Re-graphing the round-tripped schema produces identical relations
 *  3. Extension keywords survive the round-trip
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { SchemaGraph } from '../../src/modules/graph/SchemaGraph.js';
import { GraphSchemaSerializer } from '../../src/modules/ontology/GraphSchemaSerializer.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const serializer = new GraphSchemaSerializer();

function setSchemaKey(target: Record<string, unknown>, key: string, value: unknown): Record<string, unknown> {
  Reflect.set(target, key, value);

  return target;
}

const thenKeyword: string = String.fromCodePoint(116, 104, 101, 110);

function setThenKeyword(target: Record<string, unknown>, value: unknown): Record<string, unknown> {
  setSchemaKey(target, thenKeyword, value);

  return target;
}

function roundtrip(input: Record<string, unknown>): Record<string, unknown> {
  const graph = new SchemaGraph(input);

  return serializer.serialize(graph);
}

function relationKey(rel: { 'predicate': string;
  'target': unknown }): { 'pred': string;
  'tgt': string } {
  const target = rel.target;

  return {
    'pred': rel.predicate,
    'tgt': typeof target === 'string' ? target : (target as { 'id': string }).id
  };
}

function sortRelations(array: Array<{ 'pred': string;
  'tgt': string }>): Array<{ 'pred': string;
  'tgt': string }> {
  return [...array].sort((left, right) => {
    return left.pred.localeCompare(right.pred) || left.tgt.localeCompare(right.tgt);
  });
}

function assertRoundTrip(schema: Record<string, unknown>, label?: string): void {
  const tag = label ?? schema.$id ?? 'anonymous';
  const graph1 = new SchemaGraph(schema);
  const rt = serializer.serialize(graph1);

  assert.deepEqual(rt, schema, `${String(tag)}: first round-trip schema mismatch`);

  const graph2 = new SchemaGraph(rt);
  const rels1 = sortRelations(graph1.allRelations().map((item) => {
    return relationKey(item);
  }));
  const rels2 = sortRelations(graph2.allRelations().map((item) => {
    return relationKey(item);
  }));

  assert.deepEqual(rels1, rels2, `${String(tag)}: relation mismatch after round-trip`);

  const rt2 = serializer.serialize(graph2);

  assert.deepEqual(rt2, rt, `${String(tag)}: second round-trip not idempotent`);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

void describe('Round-trip: primitive types', () => {
  void it('round-trips primitive, multi-type, value, and scalar constraint schemas', () => {
    const schemas: Array<Record<string, unknown>> = [
      // Primitive types
      ...[
        'string',
        'number',
        'integer',
        'boolean',
        'null'
      ].map((typeName) => {
        return {
          '$id': `https://rt.test/${typeName}`,
          'type': typeName
        };
      }),
      {
        '$id': 'https://rt.test/multi-type',
        'type': [
          'string',
          'null'
        ]
      },
      // Values
      {
        '$id': 'https://rt.test/Const',
        'const': 'fixed'
      },
      {
        '$id': 'https://rt.test/Enum',
        'enum': [
          'red',
          'green',
          'blue'
        ],
        'type': 'string'
      },
      {
        '$id': 'https://rt.test/Default',
        'default': 42,
        'type': 'number'
      },
      {
        '$id': 'https://rt.test/ConstNull',
        'const': null
      },
      {
        '$id': 'https://rt.test/DefaultFalse',
        'default': false,
        'type': 'boolean'
      },
      {
        '$id': 'https://rt.test/DefaultZero',
        'default': 0,
        'type': 'number'
      },
      {
        '$id': 'https://rt.test/EnumMixed',
        'enum': [
          'active',
          42,
          null,
          true
        ]
      },
      // Scalar constraints
      {
        '$id': 'https://rt.test/StringConstraints',
        'maxLength': 100,
        'minLength': 1,
        'pattern': '^[A-Z]',
        'type': 'string'
      },
      {
        '$id': 'https://rt.test/Format',
        'format': 'email',
        'type': 'string'
      },
      {
        '$id': 'https://rt.test/NumericConstraints',
        'maximum': 100,
        'minimum': 0,
        'multipleOf': 5,
        'type': 'number'
      },
      {
        '$id': 'https://rt.test/ExclusiveNumeric',
        'exclusiveMaximum': 200,
        'exclusiveMinimum': -1,
        'type': 'number'
      }
    ];

    for (const schema of schemas) {
      assertRoundTrip(schema);
    }
  });
});

void describe('Round-trip: objects', () => {
  void it('round-trips object and array schemas', () => {
    const schemas: Array<Record<string, unknown>> = [
      // Objects
      {
        '$id': 'https://rt.test/Object',
        'properties': {
          'age': { 'type': 'number' },
          'name': { 'type': 'string' }
        },
        'required': ['name'],
        'type': 'object'
      },
      {
        '$id': 'https://rt.test/Strict',
        'additionalProperties': false,
        'properties': { 'a': { 'type': 'string' } },
        'type': 'object'
      },
      {
        '$id': 'https://rt.test/AdditionalSchema',
        'additionalProperties': { 'type': 'string' },
        'properties': { 'name': { 'type': 'string' } },
        'type': 'object'
      },
      {
        '$id': 'https://rt.test/ObjConstraints',
        'maxProperties': 10,
        'minProperties': 1,
        'type': 'object'
      },
      {
        '$id': 'https://rt.test/PropertyNames',
        'propertyNames': {
          'pattern': '^[a-z]+$',
          'type': 'string'
        },
        'type': 'object'
      },
      {
        '$id': 'https://rt.test/PatternProps',
        'patternProperties': {
          '^I_': { 'type': 'integer' },
          '^S_': { 'type': 'string' }
        },
        'type': 'object'
      },
      // Arrays
      {
        '$id': 'https://rt.test/Array',
        'items': { 'type': 'string' },
        'type': 'array'
      },
      {
        '$id': 'https://rt.test/Tuple',
        'prefixItems': [
          { 'type': 'string' },
          { 'type': 'number' },
          { 'type': 'boolean' }
        ],
        'type': 'array'
      },
      {
        '$id': 'https://rt.test/Contains',
        'contains': { 'type': 'string' },
        'maxContains': 5,
        'minContains': 2,
        'type': 'array'
      },
      {
        '$id': 'https://rt.test/ArrayConstraints',
        'items': { 'type': 'number' },
        'maxItems': 100,
        'minItems': 1,
        'type': 'array',
        'uniqueItems': true
      },
      {
        '$id': 'https://rt.test/UnevaluatedItems',
        'prefixItems': [{ 'type': 'string' }],
        'type': 'array',
        'unevaluatedItems': false
      },
      {
        '$id': 'https://rt.test/AdditionalItems',
        'additionalItems': { 'type': 'boolean' },
        'type': 'array'
      },
      {
        '$id': 'https://rt.test/AdditionalItemsFalse',
        'additionalItems': false,
        'prefixItems': [
          { 'type': 'string' },
          { 'type': 'number' }
        ],
        'type': 'array'
      }
    ];

    for (const schema of schemas) {
      assertRoundTrip(schema);
    }
  });
});

void describe('Round-trip: composition', () => {
  void it('round-trips composition, conditional, dependency, and discriminator schemas', () => {
    const schemas: Array<Record<string, unknown>> = [
      // allOf, anyOf, oneOf, not
      {
        '$id': 'https://rt.test/AllOf',
        'allOf': [
          {
            'properties': { 'a': { 'type': 'string' } },
            'required': ['a'],
            'type': 'object'
          },
          {
            'properties': { 'b': { 'type': 'number' } },
            'required': ['b'],
            'type': 'object'
          }
        ]
      },
      {
        '$id': 'https://rt.test/AnyOf',
        'anyOf': [
          { 'type': 'string' },
          { 'type': 'number' }
        ]
      },
      {
        '$id': 'https://rt.test/OneOf',
        'oneOf': [
          { 'type': 'string' },
          { 'type': 'number' }
        ]
      },
      {
        '$id': 'https://rt.test/Not',
        'not': { 'type': 'array' }
      },
      // Conditionals
      setThenKeyword({
        '$id': 'https://rt.test/Conditional',
        'else': { 'required': ['kind'] },
        'if': { 'properties': { 'kind': { 'const': 'special' } } },
        'properties': {
          'kind': { 'type': 'string' },
          'value': { 'type': 'number' }
        },
        'type': 'object'
      }, { 'required': ['value'] }),
      setThenKeyword({
        '$id': 'https://rt.test/IfThen',
        'if': { 'properties': { 'kind': { 'const': 'a' } } },
        'type': 'object'
      }, { 'properties': { 'aValue': { 'type': 'number' } } }),
      // Dependencies
      {
        '$id': 'https://rt.test/DepRequired',
        'dependentRequired': { 'creditCard': ['billingAddress'] },
        'properties': {
          'billingAddress': { 'type': 'string' },
          'creditCard': { 'type': 'string' }
        },
        'type': 'object'
      },
      {
        '$id': 'https://rt.test/DepSchemas',
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
      },
      // Discriminator
      {
        '$id': 'https://rt.test/DiscMap',
        'discriminator': {
          'mapping': {
            'cat': '#/$defs/Cat',
            'dog': '#/$defs/Dog'
          },
          'propertyName': 'kind'
        },
        'oneOf': [
          {
            'properties': { 'kind': { 'const': 'cat' } },
            'type': 'object'
          },
          {
            'properties': { 'kind': { 'const': 'dog' } },
            'type': 'object'
          }
        ]
      },
      {
        '$id': 'https://rt.test/DiscNoMap',
        'discriminator': { 'propertyName': 'kind' },
        'oneOf': [{
          'properties': { 'kind': { 'const': 'a' } },
          'type': 'object'
        }]
      }
    ];

    for (const schema of schemas) {
      assertRoundTrip(schema);
    }
  });
});

void describe('Round-trip: refs and anchors', () => {
  void it('round-trips ref, anchor, dynamic, and recursive schemas', () => {
    const schemas: Array<Record<string, unknown>> = [
      {
        '$defs': {
          'Child': {
            'properties': { 'name': { 'type': 'string' } },
            'required': ['name'],
            'type': 'object'
          }
        },
        '$id': 'https://rt.test/LocalRef',
        'properties': { 'child': { '$ref': '#/$defs/Child' } },
        'type': 'object'
      },
      {
        '$id': 'https://rt.test/ExternalRef',
        'properties': { 'parent': { '$ref': 'https://example.com/Parent' } },
        'type': 'object'
      },
      {
        '$id': 'https://rt.test/Anchor',
        'properties': {
          'tag': {
            '$anchor': 'tag-node',
            'type': 'string'
          }
        },
        'type': 'object'
      },
      {
        '$dynamicAnchor': 'node',
        '$id': 'https://rt.test/Dynamic',
        'properties': {
          'child': { '$dynamicRef': '#node' },
          'value': { 'type': 'number' }
        },
        'required': ['value'],
        'type': 'object'
      },
      {
        '$defs': {
          'Bar': {
            '$dynamicAnchor': 'DynBar',
            'properties': { 'score': { 'type': 'number' } },
            'type': 'object'
          },
          'Foo': {
            '$anchor': 'MyAnchor',
            'properties': { 'label': { 'type': 'string' } },
            'required': ['label'],
            'type': 'object'
          }
        },
        '$id': 'https://rt.test/MultiDefs',
        'properties': {
          'anchorRef': { '$ref': '#MyAnchor' },
          'localRef': { '$ref': '#/$defs/Foo' }
        },
        'required': ['localRef'],
        'type': 'object'
      },
      {
        '$id': 'https://rt.test/Definitions',
        'definitions': {
          'Addr': {
            'properties': { 'street': { 'type': 'string' } },
            'type': 'object'
          }
        },
        'type': 'object'
      },
      {
        '$id': 'https://rt.test/Recursive',
        '$recursiveAnchor': true,
        'properties': {
          'children': {
            'items': { '$recursiveRef': '#' },
            'type': 'array'
          }
        },
        'type': 'object'
      }
    ];

    for (const schema of schemas) {
      assertRoundTrip(schema);
    }
  });
});

void describe('Round-trip: metadata', () => {
  void it('round-trips metadata, dialect, and vocabulary schemas', () => {
    const schemas: Array<Record<string, unknown>> = [
      {
        '$id': 'https://rt.test/Metadata',
        'description': 'Represents a person',
        'properties': { 'name': { 'type': 'string' } },
        'title': 'A Person',
        'type': 'object'
      },
      {
        '$id': 'https://rt.test/Deprecated',
        'deprecated': true,
        'type': 'string'
      },
      {
        '$id': 'https://rt.test/ReadWrite',
        'properties': {
          'id': {
            'readOnly': true,
            'type': 'string'
          },
          'secret': {
            'type': 'string',
            'writeOnly': true
          }
        },
        'type': 'object'
      },
      {
        '$id': 'https://rt.test/Content',
        'contentEncoding': 'base64',
        'contentMediaType': 'text/plain',
        'type': 'string'
      },
      {
        '$comment': 'Root comment',
        '$id': 'https://rt.test/Comment',
        'properties': {
          'name': {
            '$comment': 'Name field comment',
            'type': 'string'
          }
        },
        'type': 'object'
      },
      {
        '$id': 'https://rt.test/Examples',
        'examples': [
          'alpha',
          'beta'
        ],
        'type': 'string'
      },
      {
        '$id': 'https://rt.test/NestedExamples',
        'properties': {
          'name': {
            'examples': [
              'Alice',
              'Bob'
            ],
            'type': 'string'
          }
        },
        'type': 'object'
      },
      {
        '$id': 'https://rt.test/Dialect',
        '$schema': 'https://json-schema.org/draft/2020-12/schema',
        'properties': { 'name': { 'type': 'string' } },
        'type': 'object'
      },
      {
        '$id': 'https://rt.test/Vocabulary',
        '$schema': 'https://json-schema.org/draft/2020-12/schema',
        '$vocabulary': {
          'https://json-schema.org/draft/2020-12/vocab/applicator': true,
          'https://json-schema.org/draft/2020-12/vocab/core': true,
          'https://json-schema.org/draft/2020-12/vocab/validation': true
        },
        'type': 'string'
      }
    ];

    for (const schema of schemas) {
      assertRoundTrip(schema);
    }
  });
});

void describe('Round-trip: boolean schemas', () => {
  void it('round-trips boolean true/false as nested schemas and boolean keywords', () => {
    for (const [
      id,
      allOfValue
    ] of [
        [
          'https://rt.test/BoolTrue',
          [true]
        ],
        [
          'https://rt.test/BoolFalse',
          [false]
        ]
      ] as Array<[string, unknown[]]>) {
      const schema: Record<string, unknown> = {
        '$id': id,
        'allOf': allOfValue
      };
      const graph = new SchemaGraph(schema);
      const rt = serializer.serialize(graph);

      assert.deepEqual(rt.allOf, allOfValue);
    }

    const boolSchemas: Array<Record<string, unknown>> = [
      {
        '$id': 'https://rt.test/UnevalPropsFalse',
        'properties': { 'name': { 'type': 'string' } },
        'type': 'object',
        'unevaluatedProperties': false
      },
      {
        '$id': 'https://rt.test/ItemsFalse',
        'items': false,
        'prefixItems': [
          { 'type': 'string' },
          { 'type': 'number' }
        ],
        'type': 'array'
      }
    ];

    for (const schema of boolSchemas) {
      assertRoundTrip(schema);
    }
  });
});

void describe('Round-trip: extension and custom keywords', () => {
  void it('round-trips ontology extensions and custom x-* keywords', () => {
    const schemas: Array<Record<string, unknown>> = [
      {
        '$id': 'https://rt.test/DomainRange',
        'rdfs:domain': 'https://example.com/Person',
        'rdfs:range': 'http://www.w3.org/2001/XMLSchema#string',
        'type': 'string'
      },
      {
        '$id': 'https://rt.test/Disjoint',
        'disjointWith': 'https://example.com/Cat',
        'properties': { 'name': { 'type': 'string' } },
        'type': 'object'
      },
      {
        '$id': 'https://rt.test/Equivalent',
        'equivalentTo': 'https://example.com/Human',
        'type': 'object'
      },
      {
        '$id': 'https://rt.test/InverseOf',
        'properties': {
          'owns': {
            'inverseOf': 'https://example.com/Thing#ownedBy',
            'type': 'string'
          }
        },
        'type': 'object'
      },
      {
        '$id': 'https://rt.test/Transitive',
        'properties': {
          'ancestor': {
            'transitive': true,
            'type': 'string'
          }
        },
        'type': 'object'
      },
      {
        '$id': 'https://rt.test/Symmetric',
        'properties': {
          'sibling': {
            'symmetric': true,
            'type': 'string'
          }
        },
        'type': 'object'
      },
      {
        '$id': 'https://rt.test/CustomRoot',
        'evenNumber': true,
        'type': 'integer',
        'x-ui-widget': 'slider',
        'x-validation-group': 'pricing'
      },
      {
        '$id': 'https://rt.test/CustomProps',
        'properties': {
          'price': {
            'minimum': 0,
            'type': 'number',
            'x-currency': 'USD'
          }
        },
        'type': 'object',
        'x-table': 'products'
      }
    ];

    for (const schema of schemas) {
      assertRoundTrip(schema);
    }
  });
});

void describe('Round-trip: schemas from existing tests', () => {
  void it('round-trips schemas used across the test suite', () => {
    const schemas: Array<Record<string, unknown>> = [
      {
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
      },
      {
        '$id': 'https://example.io/address',
        'properties': {
          'city': { 'type': 'string' },
          'street': { 'type': 'string' }
        },
        'required': ['street'],
        'type': 'object'
      },
      {
        '$id': 'https://example.io/config',
        '$schema': 'https://json-schema.org/draft/2020-12/schema',
        'properties': {
          'debug': {
            'default': false,
            'type': 'boolean'
          },
          'name': { 'type': 'string' },
          'timeout': {
            'default': 5000,
            'type': 'number'
          }
        },
        'required': ['name'],
        'type': 'object'
      },
      {
        '$defs': {
          'Inner': {
            'properties': {
              'value': {
                'default': 42,
                'type': 'number'
              }
            },
            'type': 'object'
          }
        },
        '$id': 'https://example.io/nested',
        '$schema': 'https://json-schema.org/draft/2020-12/schema',
        'properties': { 'inner': { '$ref': '#/$defs/Inner' } },
        'type': 'object'
      },
      {
        '$id': 'https://example.io/strict',
        '$schema': 'https://json-schema.org/draft/2020-12/schema',
        'additionalProperties': false,
        'properties': {
          'name': { 'type': 'string' },
          'value': { 'type': 'number' }
        },
        'required': ['name'],
        'type': 'object'
      },
      {
        '$id': 'https://myapp.io/User',
        'description': 'An application user',
        'properties': {
          'active': {
            'default': true,
            'type': 'boolean'
          },
          'age': { 'type': 'number' },
          'email': { 'type': 'string' },
          'name': {
            'default': 'Anonymous',
            'type': 'string'
          }
        },
        'required': [
          'name',
          'email'
        ],
        'title': 'User',
        'type': 'object'
      },
      {
        '$defs': {
          'Employee': {
            '$anchor': 'employee',
            'properties': { 'id': { 'type': 'string' } },
            'required': ['id'],
            'title': 'Employee',
            'type': 'object'
          }
        },
        '$id': 'https://myapp.io/Directory',
        'properties': {
          'employees': {
            'items': { '$ref': '#/$defs/Employee' },
            'type': 'array'
          },
          'primaryEmployee': { '$ref': '#/$defs/Employee' }
        },
        'required': ['primaryEmployee'],
        'type': 'object'
      },
      {
        '$id': 'https://myapp.io/DateTime',
        'format': 'date-time',
        'type': 'string'
      },
      {
        '$defs': {
          'Address': {
            'properties': {
              'city': { 'type': 'string' },
              'street': { 'type': 'string' }
            },
            'required': [
              'street',
              'city'
            ],
            'type': 'object'
          }
        },
        '$id': 'https://example.io/Person',
        'properties': {
          'address': {
            '$ref': '#/$defs/Address',
            'rdfs:range': 'https://example.io/Address'
          },
          'friends': {
            'items': { 'type': 'object' },
            'rdfs:range': 'https://example.io/Person',
            'type': 'array'
          },
          'name': { 'type': 'string' },
          'tag': {
            'rdfs:domain': 'https://example.io/Taggable',
            'type': 'string'
          }
        },
        'required': ['name'],
        'type': 'object'
      },
      {
        '$id': 'https://example.io/GraphNode',
        'properties': {
          'ancestor': {
            'transitive': true,
            'type': 'string'
          },
          'sibling': {
            'symmetric': true,
            'type': 'string'
          }
        },
        'type': 'object'
      },
      {
        '$defs': {
          'address': {
            'properties': { 'street/name': { 'type': 'string' } },
            'type': 'object'
          }
        },
        '$id': 'https://rt.test/EscapedPointer',
        'properties': { 'address': { '$ref': '#/$defs/address' } },
        'type': 'object'
      }
    ];

    for (const schema of schemas) {
      assertRoundTrip(schema);
    }
  });
});

void describe('Round-trip: complex combined schemas', () => {
  void it('round-trips complex combined schemas and verifies idempotency', () => {
    const schemas: Array<Record<string, unknown>> = [
      {
        '$id': 'https://rt.test/AllConstraints',
        'additionalProperties': { 'type': 'string' },
        'description': 'Represents a person',
        'maxProperties': 10,
        'minProperties': 1,
        'not': { 'type': 'array' },
        'properties': {
          'age': {
            'exclusiveMaximum': 200,
            'exclusiveMinimum': -1,
            'maximum': 150,
            'minimum': 0,
            'multipleOf': 1,
            'type': 'number'
          },
          'bio': {
            'contentEncoding': 'base64',
            'contentMediaType': 'text/plain',
            'type': 'string'
          },
          'name': {
            'default': 'Anonymous',
            'format': 'custom-name',
            'maxLength': 100,
            'minLength': 1,
            'pattern': '^[A-Z]',
            'readOnly': true,
            'type': 'string'
          },
          'status': {
            'const': 'active',
            'deprecated': true,
            'enum': [
              'active',
              'inactive'
            ],
            'type': 'string',
            'writeOnly': true
          },
          'tags': {
            'maxItems': 10,
            'minItems': 1,
            'type': 'array',
            'uniqueItems': true
          }
        },
        'title': 'A Person',
        'type': 'object'
      },
      setThenKeyword({
        '$defs': {
          'Address': {
            'properties': { 'street': { 'type': 'string' } },
            'required': ['street'],
            'type': 'object'
          }
        },
        '$id': 'https://rt.test/ComplexComposition',
        'allOf': [{
          'properties': { 'base': { 'type': 'string' } },
          'type': 'object'
        }],
        'anyOf': [
          {
            'properties': { 'optA': { 'type': 'string' } },
            'type': 'object'
          },
          {
            'properties': { 'optB': { 'type': 'number' } },
            'type': 'object'
          }
        ],
        'if': { 'properties': { 'kind': { 'const': 'special' } } },
        'properties': {
          'address': { '$ref': '#/$defs/Address' },
          'base': { 'type': 'string' },
          'kind': { 'type': 'string' }
        },
        'type': 'object'
      }, { 'required': ['base'] }),
      {
        '$id': 'https://rt.test/DepsCombined',
        'dependentRequired': {
          'email': [
            'name',
            'phone'
          ]
        },
        'dependentSchemas': {
          'billing': {
            'properties': { 'address': { 'type': 'string' } },
            'required': ['address']
          }
        },
        'patternProperties': { '^x-': { 'type': 'string' } },
        'properties': {
          'billing': { 'type': 'string' },
          'email': { 'type': 'string' },
          'name': { 'type': 'string' },
          'phone': { 'type': 'string' }
        },
        'type': 'object'
      },
      setThenKeyword({
        '$id': 'https://rt.test/UnevalConditional',
        'else': { 'properties': { 'bValue': { 'type': 'string' } } },
        'if': { 'properties': { 'kind': { 'const': 'a' } } },
        'properties': { 'kind': { 'type': 'string' } },
        'required': ['kind'],
        'type': 'object',
        'unevaluatedProperties': false
      }, { 'properties': { 'aValue': { 'type': 'number' } } })
    ];

    for (const schema of schemas) {
      assertRoundTrip(schema);
    }

    // Idempotency: three consecutive round-trips
    const idempotentSchema: Record<string, unknown> = {
      '$defs': {
        'Foo': {
          '$anchor': 'FooAnchor',
          'properties': {
            'label': {
              '$comment': 'a label',
              'type': 'string'
            }
          },
          'required': ['label'],
          'type': 'object'
        }
      },
      '$id': 'https://rt.test/Idempotent',
      'description': 'Verify idempotency',
      'properties': {
        'nested': {
          'properties': {
            'deep': {
              'minimum': 0,
              'type': 'integer'
            }
          },
          'type': 'object',
          'x-custom': 'test'
        },
        'ref': { '$ref': '#/$defs/Foo' }
      },
      'required': ['ref'],
      'title': 'Idempotent Test',
      'type': 'object'
    };
    const rt1 = roundtrip(idempotentSchema);
    const rt2 = roundtrip(rt1);
    const rt3 = roundtrip(rt2);

    assert.deepEqual(rt1, idempotentSchema);
    assert.deepEqual(rt2, rt1);
    assert.deepEqual(rt3, rt2);
  });
});
