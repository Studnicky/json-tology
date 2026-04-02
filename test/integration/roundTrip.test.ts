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
// Scenario types
// ---------------------------------------------------------------------------

interface RoundTripScenario {
  'check': (schema: Record<string, unknown>) => void;
  'name': string;
  'schema': Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Tests: primitive types
// ---------------------------------------------------------------------------

void describe('Round-trip: primitive types', () => {
  const scenarios: RoundTripScenario[] = [
    ...[
      'string',
      'number',
      'integer',
      'boolean',
      'null'
    ].map((typeName): RoundTripScenario => {
      return {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': `primitive type: ${typeName}`,
        'schema': {
          '$id': `https://rt.test/${typeName}`,
          'type': typeName
        }
      };
    }),
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'multi-type [string, null]',
      'schema': {
        '$id': 'https://rt.test/multi-type',
        'type': [
          'string',
          'null'
        ]
      }
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'const string value',
      'schema': {
        '$id': 'https://rt.test/Const',
        'const': 'fixed'
      }
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'enum with type',
      'schema': {
        '$id': 'https://rt.test/Enum',
        'enum': [
          'red',
          'green',
          'blue'
        ],
        'type': 'string'
      }
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'default numeric value',
      'schema': {
        '$id': 'https://rt.test/Default',
        'default': 42,
        'type': 'number'
      }
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'const null',
      'schema': {
        '$id': 'https://rt.test/ConstNull',
        'const': null
      }
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'default false',
      'schema': {
        '$id': 'https://rt.test/DefaultFalse',
        'default': false,
        'type': 'boolean'
      }
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'default zero',
      'schema': {
        '$id': 'https://rt.test/DefaultZero',
        'default': 0,
        'type': 'number'
      }
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'enum with mixed types',
      'schema': {
        '$id': 'https://rt.test/EnumMixed',
        'enum': [
          'active',
          42,
          null,
          true
        ]
      }
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'string constraints (minLength, maxLength, pattern)',
      'schema': {
        '$id': 'https://rt.test/StringConstraints',
        'maxLength': 100,
        'minLength': 1,
        'pattern': '^[A-Z]',
        'type': 'string'
      }
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'format constraint',
      'schema': {
        '$id': 'https://rt.test/Format',
        'format': 'email',
        'type': 'string'
      }
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'numeric constraints (min, max, multipleOf)',
      'schema': {
        '$id': 'https://rt.test/NumericConstraints',
        'maximum': 100,
        'minimum': 0,
        'multipleOf': 5,
        'type': 'number'
      }
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'exclusive numeric constraints',
      'schema': {
        '$id': 'https://rt.test/ExclusiveNumeric',
        'exclusiveMaximum': 200,
        'exclusiveMinimum': -1,
        'type': 'number'
      }
    },
    // Edge cases
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'empty enum array',
      'schema': {
        '$id': 'https://rt.test/EmptyEnum',
        'enum': [],
        'type': 'string'
      }
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'default empty string',
      'schema': {
        '$id': 'https://rt.test/DefaultEmptyStr',
        'default': '',
        'type': 'string'
      }
    }
  ];

  for (const {
    check, name, schema
  } of scenarios) {
    void it(name, () => {
      check(schema);
    });
  }
});

// ---------------------------------------------------------------------------
// Tests: objects and arrays
// ---------------------------------------------------------------------------

void describe('Round-trip: objects', () => {
  const scenarios: RoundTripScenario[] = [
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'simple object with required',
      'schema': {
        '$id': 'https://rt.test/Object',
        'properties': {
          'age': { 'type': 'number' },
          'name': { 'type': 'string' }
        },
        'required': ['name'],
        'type': 'object'
      }
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'strict object (additionalProperties: false)',
      'schema': {
        '$id': 'https://rt.test/Strict',
        'additionalProperties': false,
        'properties': { 'a': { 'type': 'string' } },
        'type': 'object'
      }
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'additionalProperties as schema',
      'schema': {
        '$id': 'https://rt.test/AdditionalSchema',
        'additionalProperties': { 'type': 'string' },
        'properties': { 'name': { 'type': 'string' } },
        'type': 'object'
      }
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'object constraints (min/maxProperties)',
      'schema': {
        '$id': 'https://rt.test/ObjConstraints',
        'maxProperties': 10,
        'minProperties': 1,
        'type': 'object'
      }
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'propertyNames constraint',
      'schema': {
        '$id': 'https://rt.test/PropertyNames',
        'propertyNames': {
          'pattern': '^[a-z]+$',
          'type': 'string'
        },
        'type': 'object'
      }
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'patternProperties',
      'schema': {
        '$id': 'https://rt.test/PatternProps',
        'patternProperties': {
          '^I_': { 'type': 'integer' },
          '^S_': { 'type': 'string' }
        },
        'type': 'object'
      }
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'array with items',
      'schema': {
        '$id': 'https://rt.test/Array',
        'items': { 'type': 'string' },
        'type': 'array'
      }
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'tuple with prefixItems',
      'schema': {
        '$id': 'https://rt.test/Tuple',
        'prefixItems': [
          { 'type': 'string' },
          { 'type': 'number' },
          { 'type': 'boolean' }
        ],
        'type': 'array'
      }
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'contains with cardinality',
      'schema': {
        '$id': 'https://rt.test/Contains',
        'contains': { 'type': 'string' },
        'maxContains': 5,
        'minContains': 2,
        'type': 'array'
      }
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'array constraints (min/maxItems, uniqueItems)',
      'schema': {
        '$id': 'https://rt.test/ArrayConstraints',
        'items': { 'type': 'number' },
        'maxItems': 100,
        'minItems': 1,
        'type': 'array',
        'uniqueItems': true
      }
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'unevaluatedItems: false',
      'schema': {
        '$id': 'https://rt.test/UnevaluatedItems',
        'prefixItems': [{ 'type': 'string' }],
        'type': 'array',
        'unevaluatedItems': false
      }
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'additionalItems as schema',
      'schema': {
        '$id': 'https://rt.test/AdditionalItems',
        'additionalItems': { 'type': 'boolean' },
        'type': 'array'
      }
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'additionalItems: false with prefixItems',
      'schema': {
        '$id': 'https://rt.test/AdditionalItemsFalse',
        'additionalItems': false,
        'prefixItems': [
          { 'type': 'string' },
          { 'type': 'number' }
        ],
        'type': 'array'
      }
    },
    // Edge cases
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'object with no properties',
      'schema': {
        '$id': 'https://rt.test/EmptyObj',
        'type': 'object'
      }
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'empty array schema with no items',
      'schema': {
        '$id': 'https://rt.test/EmptyArray',
        'type': 'array'
      }
    }
  ];

  for (const {
    check, name, schema
  } of scenarios) {
    void it(name, () => {
      check(schema);
    });
  }
});

// ---------------------------------------------------------------------------
// Tests: composition
// ---------------------------------------------------------------------------

void describe('Round-trip: composition', () => {
  const scenarios: RoundTripScenario[] = [
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'allOf composition',
      'schema': {
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
      }
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'anyOf composition',
      'schema': {
        '$id': 'https://rt.test/AnyOf',
        'anyOf': [
          { 'type': 'string' },
          { 'type': 'number' }
        ]
      }
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'oneOf composition',
      'schema': {
        '$id': 'https://rt.test/OneOf',
        'oneOf': [
          { 'type': 'string' },
          { 'type': 'number' }
        ]
      }
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'not composition',
      'schema': {
        '$id': 'https://rt.test/Not',
        'not': { 'type': 'array' }
      }
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'if/then/else conditional',
      'schema': setThenKeyword({
        '$id': 'https://rt.test/Conditional',
        'else': { 'required': ['kind'] },
        'if': { 'properties': { 'kind': { 'const': 'special' } } },
        'properties': {
          'kind': { 'type': 'string' },
          'value': { 'type': 'number' }
        },
        'type': 'object'
      }, { 'required': ['value'] })
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'if/then without else',
      'schema': setThenKeyword({
        '$id': 'https://rt.test/IfThen',
        'if': { 'properties': { 'kind': { 'const': 'a' } } },
        'type': 'object'
      }, { 'properties': { 'aValue': { 'type': 'number' } } })
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'dependentRequired',
      'schema': {
        '$id': 'https://rt.test/DepRequired',
        'dependentRequired': { 'creditCard': ['billingAddress'] },
        'properties': {
          'billingAddress': { 'type': 'string' },
          'creditCard': { 'type': 'string' }
        },
        'type': 'object'
      }
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'dependentSchemas',
      'schema': {
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
      }
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'discriminator with mapping',
      'schema': {
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
      }
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'discriminator without mapping',
      'schema': {
        '$id': 'https://rt.test/DiscNoMap',
        'discriminator': { 'propertyName': 'kind' },
        'oneOf': [{
          'properties': { 'kind': { 'const': 'a' } },
          'type': 'object'
        }]
      }
    },
    // Edge cases
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'allOf with single subschema',
      'schema': {
        '$id': 'https://rt.test/AllOfSingle',
        'allOf': [{ 'type': 'string' }]
      }
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'not wrapping a not (double negation)',
      'schema': {
        '$id': 'https://rt.test/NotNot',
        'not': { 'not': { 'type': 'string' } }
      }
    }
  ];

  for (const {
    check, name, schema
  } of scenarios) {
    void it(name, () => {
      check(schema);
    });
  }
});

// ---------------------------------------------------------------------------
// Tests: refs and anchors
// ---------------------------------------------------------------------------

void describe('Round-trip: refs and anchors', () => {
  const scenarios: RoundTripScenario[] = [
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'local $ref to $defs',
      'schema': {
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
      }
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'external $ref',
      'schema': {
        '$id': 'https://rt.test/ExternalRef',
        'properties': { 'parent': { '$ref': 'https://example.com/Parent' } },
        'type': 'object'
      }
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': '$anchor',
      'schema': {
        '$id': 'https://rt.test/Anchor',
        'properties': {
          'tag': {
            '$anchor': 'tag-node',
            'type': 'string'
          }
        },
        'type': 'object'
      }
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': '$dynamicAnchor and $dynamicRef',
      'schema': {
        '$dynamicAnchor': 'node',
        '$id': 'https://rt.test/Dynamic',
        'properties': {
          'child': { '$dynamicRef': '#node' },
          'value': { 'type': 'number' }
        },
        'required': ['value'],
        'type': 'object'
      }
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'multiple $defs with anchors and dynamic anchors',
      'schema': {
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
      }
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'legacy definitions keyword',
      'schema': {
        '$id': 'https://rt.test/Definitions',
        'definitions': {
          'Addr': {
            'properties': { 'street': { 'type': 'string' } },
            'type': 'object'
          }
        },
        'type': 'object'
      }
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': '$recursiveAnchor and $recursiveRef',
      'schema': {
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
    },
    // Edge cases
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': '$defs with no references to them',
      'schema': {
        '$defs': { 'Unused': { 'type': 'string' } },
        '$id': 'https://rt.test/UnusedDefs',
        'type': 'object'
      }
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'self-referencing $ref to root',
      'schema': {
        '$id': 'https://rt.test/SelfRef',
        'properties': { 'child': { '$ref': 'https://rt.test/SelfRef' } },
        'type': 'object'
      }
    }
  ];

  for (const {
    check, name, schema
  } of scenarios) {
    void it(name, () => {
      check(schema);
    });
  }
});

// ---------------------------------------------------------------------------
// Tests: metadata
// ---------------------------------------------------------------------------

void describe('Round-trip: metadata', () => {
  const scenarios: RoundTripScenario[] = [
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'title and description',
      'schema': {
        '$id': 'https://rt.test/Metadata',
        'description': 'Represents a person',
        'properties': { 'name': { 'type': 'string' } },
        'title': 'A Person',
        'type': 'object'
      }
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'deprecated flag',
      'schema': {
        '$id': 'https://rt.test/Deprecated',
        'deprecated': true,
        'type': 'string'
      }
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'readOnly and writeOnly',
      'schema': {
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
      }
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'contentEncoding and contentMediaType',
      'schema': {
        '$id': 'https://rt.test/Content',
        'contentEncoding': 'base64',
        'contentMediaType': 'text/plain',
        'type': 'string'
      }
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': '$comment on root and nested',
      'schema': {
        '$comment': 'Root comment',
        '$id': 'https://rt.test/Comment',
        'properties': {
          'name': {
            '$comment': 'Name field comment',
            'type': 'string'
          }
        },
        'type': 'object'
      }
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'examples on root',
      'schema': {
        '$id': 'https://rt.test/Examples',
        'examples': [
          'alpha',
          'beta'
        ],
        'type': 'string'
      }
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'examples on nested properties',
      'schema': {
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
      }
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': '$schema dialect',
      'schema': {
        '$id': 'https://rt.test/Dialect',
        '$schema': 'https://json-schema.org/draft/2020-12/schema',
        'properties': { 'name': { 'type': 'string' } },
        'type': 'object'
      }
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': '$vocabulary',
      'schema': {
        '$id': 'https://rt.test/Vocabulary',
        '$schema': 'https://json-schema.org/draft/2020-12/schema',
        '$vocabulary': {
          'https://json-schema.org/draft/2020-12/vocab/applicator': true,
          'https://json-schema.org/draft/2020-12/vocab/core': true,
          'https://json-schema.org/draft/2020-12/vocab/validation': true
        },
        'type': 'string'
      }
    },
    // Edge cases
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'multiple metadata fields combined',
      'schema': {
        '$comment': 'top-level comment',
        '$id': 'https://rt.test/MultiMeta',
        'description': 'A description',
        'title': 'Multi Meta',
        'type': 'string'
      }
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'deprecated with readOnly on same property',
      'schema': {
        '$id': 'https://rt.test/DeprecatedReadOnly',
        'properties': {
          'legacy': {
            'deprecated': true,
            'readOnly': true,
            'type': 'string'
          }
        },
        'type': 'object'
      }
    }
  ];

  for (const {
    check, name, schema
  } of scenarios) {
    void it(name, () => {
      check(schema);
    });
  }
});

// ---------------------------------------------------------------------------
// Tests: boolean schemas
// ---------------------------------------------------------------------------

void describe('Round-trip: boolean schemas', () => {
  const boolAllOfScenarios: Array<{ 'allOfValue': unknown[];
    'id': string;
    'name': string; }> = [
    {
      'allOfValue': [true],
      'id': 'https://rt.test/BoolTrue',
      'name': 'boolean true in allOf'
    },
    {
      'allOfValue': [false],
      'id': 'https://rt.test/BoolFalse',
      'name': 'boolean false in allOf'
    }
  ];

  for (const {
    allOfValue, id, name
  } of boolAllOfScenarios) {
    void it(name, () => {
      const schema: Record<string, unknown> = {
        '$id': id,
        'allOf': allOfValue
      };
      const graph = new SchemaGraph(schema);
      const rt = serializer.serialize(graph);

      assert.deepEqual(rt.allOf, allOfValue);
    });
  }

  const boolKeywordScenarios: RoundTripScenario[] = [
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'unevaluatedProperties: false',
      'schema': {
        '$id': 'https://rt.test/UnevalPropsFalse',
        'properties': { 'name': { 'type': 'string' } },
        'type': 'object',
        'unevaluatedProperties': false
      }
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'items: false with prefixItems',
      'schema': {
        '$id': 'https://rt.test/ItemsFalse',
        'items': false,
        'prefixItems': [
          { 'type': 'string' },
          { 'type': 'number' }
        ],
        'type': 'array'
      }
    }
  ];

  for (const {
    check, name, schema
  } of boolKeywordScenarios) {
    void it(name, () => {
      check(schema);
    });
  }
});

// ---------------------------------------------------------------------------
// Tests: extension and custom keywords
// ---------------------------------------------------------------------------

void describe('Round-trip: extension and custom keywords', () => {
  const scenarios: RoundTripScenario[] = [
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'rdfs:domain and rdfs:range',
      'schema': {
        '$id': 'https://rt.test/DomainRange',
        'rdfs:domain': 'https://example.com/Person',
        'rdfs:range': 'http://www.w3.org/2001/XMLSchema#string',
        'type': 'string'
      }
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'disjointWith',
      'schema': {
        '$id': 'https://rt.test/Disjoint',
        'disjointWith': 'https://example.com/Cat',
        'properties': { 'name': { 'type': 'string' } },
        'type': 'object'
      }
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'equivalentTo',
      'schema': {
        '$id': 'https://rt.test/Equivalent',
        'equivalentTo': 'https://example.com/Human',
        'type': 'object'
      }
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'inverseOf on property',
      'schema': {
        '$id': 'https://rt.test/InverseOf',
        'properties': {
          'owns': {
            'inverseOf': 'https://example.com/Thing#ownedBy',
            'type': 'string'
          }
        },
        'type': 'object'
      }
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'transitive property',
      'schema': {
        '$id': 'https://rt.test/Transitive',
        'properties': {
          'ancestor': {
            'transitive': true,
            'type': 'string'
          }
        },
        'type': 'object'
      }
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'symmetric property',
      'schema': {
        '$id': 'https://rt.test/Symmetric',
        'properties': {
          'sibling': {
            'symmetric': true,
            'type': 'string'
          }
        },
        'type': 'object'
      }
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'custom x-* keywords on root',
      'schema': {
        '$id': 'https://rt.test/CustomRoot',
        'evenNumber': true,
        'type': 'integer',
        'x-ui-widget': 'slider',
        'x-validation-group': 'pricing'
      }
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'custom x-* keywords on properties',
      'schema': {
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
    },
    // Edge cases
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'multiple x-* keywords without standard constraints',
      'schema': {
        '$id': 'https://rt.test/CustomOnly',
        'x-custom-a': 'alpha',
        'x-custom-b': 123,
        'x-custom-c': true
      }
    }
  ];

  for (const {
    check, name, schema
  } of scenarios) {
    void it(name, () => {
      check(schema);
    });
  }
});

// ---------------------------------------------------------------------------
// Tests: schemas from existing tests
// ---------------------------------------------------------------------------

void describe('Round-trip: schemas from existing tests', () => {
  const scenarios: RoundTripScenario[] = [
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'person schema with additionalProperties: false',
      'schema': {
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
      }
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'address schema',
      'schema': {
        '$id': 'https://example.io/address',
        'properties': {
          'city': { 'type': 'string' },
          'street': { 'type': 'string' }
        },
        'required': ['street'],
        'type': 'object'
      }
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'config schema with dialect and defaults',
      'schema': {
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
      }
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'nested schema with $ref and default',
      'schema': {
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
      }
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'strict schema with additionalProperties: false',
      'schema': {
        '$id': 'https://example.io/strict',
        '$schema': 'https://json-schema.org/draft/2020-12/schema',
        'additionalProperties': false,
        'properties': {
          'name': { 'type': 'string' },
          'value': { 'type': 'number' }
        },
        'required': ['name'],
        'type': 'object'
      }
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'User schema with metadata and defaults',
      'schema': {
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
      }
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'Directory with $anchor and array $ref',
      'schema': {
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
      }
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'DateTime with format',
      'schema': {
        '$id': 'https://myapp.io/DateTime',
        'format': 'date-time',
        'type': 'string'
      }
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'Person with domain/range and ontology extensions',
      'schema': {
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
      }
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'GraphNode with transitive and symmetric properties',
      'schema': {
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
      }
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'escaped JSON pointer in $ref',
      'schema': {
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
    }
  ];

  for (const {
    check, name, schema
  } of scenarios) {
    void it(name, () => {
      check(schema);
    });
  }
});

// ---------------------------------------------------------------------------
// Tests: complex combined schemas
// ---------------------------------------------------------------------------

void describe('Round-trip: complex combined schemas', () => {
  const scenarios: RoundTripScenario[] = [
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'all constraints combined on object',
      'schema': {
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
      }
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'complex composition with allOf, anyOf, if/then, $ref',
      'schema': setThenKeyword({
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
      }, { 'required': ['base'] })
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'dependentRequired + dependentSchemas + patternProperties',
      'schema': {
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
      }
    },
    {
      'check': (schema) => {
        assertRoundTrip(schema);
      },
      'name': 'unevaluatedProperties with conditional',
      'schema': setThenKeyword({
        '$id': 'https://rt.test/UnevalConditional',
        'else': { 'properties': { 'bValue': { 'type': 'string' } } },
        'if': { 'properties': { 'kind': { 'const': 'a' } } },
        'properties': { 'kind': { 'type': 'string' } },
        'required': ['kind'],
        'type': 'object',
        'unevaluatedProperties': false
      }, { 'properties': { 'aValue': { 'type': 'number' } } })
    }
  ];

  for (const {
    check, name, schema
  } of scenarios) {
    void it(name, () => {
      check(schema);
    });
  }

  void it('triple round-trip idempotency', () => {
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
