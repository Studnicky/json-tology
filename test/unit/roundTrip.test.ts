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

function roundtrip(input: Record<string, unknown>): Record<string, unknown> {
  const graph = new SchemaGraph(input);

  return serializer.serialize(graph);
}

/**
 * Normalize a relation target to a comparable string.
 * Node targets use their id; string targets pass through.
 */
function relationKey(r: { 'predicate': string;
  'target': unknown }): { 'p': string;
  't': string } {
  const target = r.target;

  return {
    'p': r.predicate,
    't': typeof target === 'string' ? target : (target as { 'id': string }).id
  };
}

/**
 * Assert a full round-trip: schema -> graph -> schema -> graph.
 *  - The serialized schema deeply equals the input.
 *  - Relations from both graphs match.
 */
function assertRoundTrip(schema: Record<string, unknown>, label?: string): void {
  const tag = label ?? schema.$id ?? 'anonymous';

  // Pass 1: serialize
  const graph1 = new SchemaGraph(schema);
  const rt = serializer.serialize(graph1);

  assert.deepEqual(rt, schema, `${tag}: first round-trip schema mismatch`);

  // Pass 2: verify relation stability (sort for order-independence)
  const graph2 = new SchemaGraph(rt);
  const sortRels = (arr: Array<{ 'p': string;
    't': string }>) => {
    return [...arr].sort((a, b) => {
      return a.p.localeCompare(b.p) || a.t.localeCompare(b.t);
    });
  };
  const rels1 = sortRels(graph1.allRelations().map(relationKey));
  const rels2 = sortRels(graph2.allRelations().map(relationKey));

  assert.deepEqual(rels1, rels2, `${tag}: relation mismatch after round-trip`);

  // Pass 3: idempotency — second round-trip equals the first
  const rt2 = serializer.serialize(graph2);

  assert.deepEqual(rt2, rt, `${tag}: second round-trip not idempotent`);
}

// ---------------------------------------------------------------------------
// 1. Primitive type schemas
// ---------------------------------------------------------------------------

describe('Round-trip: primitive types', () => {
  for (const t of [
    'string',
    'number',
    'integer',
    'boolean',
    'null'
  ]) {
    it(`round-trips type: ${t}`, () => {
      assertRoundTrip({
        '$id': `https://rt.test/${t}`,
        'type': t
      });
    });
  }

  it('round-trips multi-type array', () => {
    assertRoundTrip({
      '$id': 'https://rt.test/multi-type',
      'type': [
        'string',
        'null'
      ]
    });
  });
});

// ---------------------------------------------------------------------------
// 2. Object schemas
// ---------------------------------------------------------------------------

describe('Round-trip: objects', () => {
  it('round-trips object with properties and required', () => {
    assertRoundTrip({
      '$id': 'https://rt.test/Object',
      'properties': {
        'age': { 'type': 'number' },
        'name': { 'type': 'string' }
      },
      'required': ['name'],
      'type': 'object'
    });
  });

  it('round-trips additionalProperties: false', () => {
    assertRoundTrip({
      '$id': 'https://rt.test/Strict',
      'additionalProperties': false,
      'properties': { 'a': { 'type': 'string' } },
      'type': 'object'
    });
  });

  it('round-trips additionalProperties as schema', () => {
    assertRoundTrip({
      '$id': 'https://rt.test/AdditionalSchema',
      'additionalProperties': { 'type': 'string' },
      'properties': { 'name': { 'type': 'string' } },
      'type': 'object'
    });
  });

  it('round-trips minProperties and maxProperties', () => {
    assertRoundTrip({
      '$id': 'https://rt.test/ObjConstraints',
      'maxProperties': 10,
      'minProperties': 1,
      'type': 'object'
    });
  });

  it('round-trips propertyNames', () => {
    assertRoundTrip({
      '$id': 'https://rt.test/PropertyNames',
      'propertyNames': {
        'pattern': '^[a-z]+$',
        'type': 'string'
      },
      'type': 'object'
    });
  });

  it('round-trips patternProperties', () => {
    assertRoundTrip({
      '$id': 'https://rt.test/PatternProps',
      'patternProperties': {
        '^I_': { 'type': 'integer' },
        '^S_': { 'type': 'string' }
      },
      'type': 'object'
    });
  });
});

// ---------------------------------------------------------------------------
// 3. Array schemas
// ---------------------------------------------------------------------------

describe('Round-trip: arrays', () => {
  it('round-trips array with items', () => {
    assertRoundTrip({
      '$id': 'https://rt.test/Array',
      'items': { 'type': 'string' },
      'type': 'array'
    });
  });

  it('round-trips prefixItems', () => {
    assertRoundTrip({
      '$id': 'https://rt.test/Tuple',
      'prefixItems': [
        { 'type': 'string' },
        { 'type': 'number' },
        { 'type': 'boolean' }
      ],
      'type': 'array'
    });
  });

  it('round-trips contains with minContains/maxContains', () => {
    assertRoundTrip({
      '$id': 'https://rt.test/Contains',
      'contains': { 'type': 'string' },
      'maxContains': 5,
      'minContains': 2,
      'type': 'array'
    });
  });

  it('round-trips minItems, maxItems, uniqueItems', () => {
    assertRoundTrip({
      '$id': 'https://rt.test/ArrayConstraints',
      'items': { 'type': 'number' },
      'maxItems': 100,
      'minItems': 1,
      'type': 'array',
      'uniqueItems': true
    });
  });

  it('round-trips unevaluatedItems', () => {
    assertRoundTrip({
      '$id': 'https://rt.test/UnevaluatedItems',
      'prefixItems': [{ 'type': 'string' }],
      'type': 'array',
      'unevaluatedItems': false
    });
  });

  it('round-trips additionalItems with schema', () => {
    assertRoundTrip({
      '$id': 'https://rt.test/AdditionalItems',
      'additionalItems': { 'type': 'boolean' },
      'type': 'array'
    });
  });

  it('round-trips additionalItems: false', () => {
    assertRoundTrip({
      '$id': 'https://rt.test/AdditionalItemsFalse',
      'additionalItems': false,
      'prefixItems': [
        { 'type': 'string' },
        { 'type': 'number' }
      ],
      'type': 'array'
    });
  });
});

// ---------------------------------------------------------------------------
// 4. Composition keywords
// ---------------------------------------------------------------------------

describe('Round-trip: composition', () => {
  it('round-trips allOf', () => {
    assertRoundTrip({
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
    });
  });

  it('round-trips anyOf', () => {
    assertRoundTrip({
      '$id': 'https://rt.test/AnyOf',
      'anyOf': [
        { 'type': 'string' },
        { 'type': 'number' }
      ]
    });
  });

  it('round-trips oneOf', () => {
    assertRoundTrip({
      '$id': 'https://rt.test/OneOf',
      'oneOf': [
        { 'type': 'string' },
        { 'type': 'number' }
      ]
    });
  });

  it('round-trips not', () => {
    assertRoundTrip({
      '$id': 'https://rt.test/Not',
      'not': { 'type': 'array' }
    });
  });
});

// ---------------------------------------------------------------------------
// 5. Conditionals
// ---------------------------------------------------------------------------

describe('Round-trip: conditionals', () => {
  it('round-trips if/then/else', () => {
    assertRoundTrip({
      '$id': 'https://rt.test/Conditional',
      'else': { 'required': ['kind'] },
      'if': { 'properties': { 'kind': { 'const': 'special' } } },
      'properties': {
        'kind': { 'type': 'string' },
        'value': { 'type': 'number' }
      },
      'then': { 'required': ['value'] },
      'type': 'object'
    });
  });

  it('round-trips if/then without else', () => {
    assertRoundTrip({
      '$id': 'https://rt.test/IfThen',
      'if': { 'properties': { 'kind': { 'const': 'a' } } },
      'then': { 'properties': { 'aValue': { 'type': 'number' } } },
      'type': 'object'
    });
  });
});

// ---------------------------------------------------------------------------
// 6. Refs, anchors, $defs, definitions
// ---------------------------------------------------------------------------

describe('Round-trip: refs and anchors', () => {
  it('round-trips $ref (local pointer)', () => {
    assertRoundTrip({
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
    });
  });

  it('round-trips $ref (external pattern)', () => {
    assertRoundTrip({
      '$id': 'https://rt.test/ExternalRef',
      'properties': { 'parent': { '$ref': 'https://example.com/Parent' } },
      'type': 'object'
    });
  });

  it('round-trips $anchor', () => {
    assertRoundTrip({
      '$id': 'https://rt.test/Anchor',
      'properties': {
        'tag': {
          '$anchor': 'tag-node',
          'type': 'string'
        }
      },
      'type': 'object'
    });
  });

  it('round-trips $dynamicAnchor and $dynamicRef', () => {
    assertRoundTrip({
      '$dynamicAnchor': 'node',
      '$id': 'https://rt.test/Dynamic',
      'properties': {
        'child': { '$dynamicRef': '#node' },
        'value': { 'type': 'number' }
      },
      'required': ['value'],
      'type': 'object'
    });
  });

  it('round-trips $defs with multiple entries', () => {
    assertRoundTrip({
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
    });
  });

  it('round-trips definitions (draft-07)', () => {
    assertRoundTrip({
      '$id': 'https://rt.test/Definitions',
      'definitions': {
        'Addr': {
          'properties': { 'street': { 'type': 'string' } },
          'type': 'object'
        }
      },
      'type': 'object'
    });
  });

  it('round-trips $recursiveAnchor and $recursiveRef', () => {
    assertRoundTrip({
      '$id': 'https://rt.test/Recursive',
      '$recursiveAnchor': true,
      'properties': {
        'children': {
          'items': { '$recursiveRef': '#' },
          'type': 'array'
        }
      },
      'type': 'object'
    });
  });
});

// ---------------------------------------------------------------------------
// 7. String constraints
// ---------------------------------------------------------------------------

describe('Round-trip: string constraints', () => {
  it('round-trips minLength, maxLength, pattern', () => {
    assertRoundTrip({
      '$id': 'https://rt.test/StringConstraints',
      'maxLength': 100,
      'minLength': 1,
      'pattern': '^[A-Z]',
      'type': 'string'
    });
  });

  it('round-trips format', () => {
    assertRoundTrip({
      '$id': 'https://rt.test/Format',
      'format': 'email',
      'type': 'string'
    });
  });
});

// ---------------------------------------------------------------------------
// 8. Numeric constraints
// ---------------------------------------------------------------------------

describe('Round-trip: numeric constraints', () => {
  it('round-trips minimum, maximum, multipleOf', () => {
    assertRoundTrip({
      '$id': 'https://rt.test/NumericConstraints',
      'maximum': 100,
      'minimum': 0,
      'multipleOf': 5,
      'type': 'number'
    });
  });

  it('round-trips exclusiveMinimum, exclusiveMaximum', () => {
    assertRoundTrip({
      '$id': 'https://rt.test/ExclusiveNumeric',
      'exclusiveMaximum': 200,
      'exclusiveMinimum': -1,
      'type': 'number'
    });
  });
});

// ---------------------------------------------------------------------------
// 9. Value keywords
// ---------------------------------------------------------------------------

describe('Round-trip: values', () => {
  it('round-trips const', () => {
    assertRoundTrip({
      '$id': 'https://rt.test/Const',
      'const': 'fixed'
    });
  });

  it('round-trips enum', () => {
    assertRoundTrip({
      '$id': 'https://rt.test/Enum',
      'enum': [
        'red',
        'green',
        'blue'
      ],
      'type': 'string'
    });
  });

  it('round-trips default', () => {
    assertRoundTrip({
      '$id': 'https://rt.test/Default',
      'default': 42,
      'type': 'number'
    });
  });

  it('round-trips const: null', () => {
    assertRoundTrip({
      '$id': 'https://rt.test/ConstNull',
      'const': null
    });
  });

  it('round-trips default: false (falsy value)', () => {
    assertRoundTrip({
      '$id': 'https://rt.test/DefaultFalse',
      'default': false,
      'type': 'boolean'
    });
  });

  it('round-trips default: 0 (falsy value)', () => {
    assertRoundTrip({
      '$id': 'https://rt.test/DefaultZero',
      'default': 0,
      'type': 'number'
    });
  });

  it('round-trips enum with mixed types', () => {
    assertRoundTrip({
      '$id': 'https://rt.test/EnumMixed',
      'enum': [
        'active',
        42,
        null,
        true
      ]
    });
  });
});

// ---------------------------------------------------------------------------
// 10. Metadata keywords
// ---------------------------------------------------------------------------

describe('Round-trip: metadata', () => {
  it('round-trips title and description', () => {
    assertRoundTrip({
      '$id': 'https://rt.test/Metadata',
      'description': 'Represents a person',
      'properties': { 'name': { 'type': 'string' } },
      'title': 'A Person',
      'type': 'object'
    });
  });

  it('round-trips deprecated', () => {
    assertRoundTrip({
      '$id': 'https://rt.test/Deprecated',
      'deprecated': true,
      'type': 'string'
    });
  });

  it('round-trips readOnly and writeOnly', () => {
    assertRoundTrip({
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
    });
  });

  it('round-trips contentEncoding and contentMediaType', () => {
    assertRoundTrip({
      '$id': 'https://rt.test/Content',
      'contentEncoding': 'base64',
      'contentMediaType': 'text/plain',
      'type': 'string'
    });
  });

  it('round-trips $comment on root and nested', () => {
    assertRoundTrip({
      '$comment': 'Root comment',
      '$id': 'https://rt.test/Comment',
      'properties': {
        'name': {
          '$comment': 'Name field comment',
          'type': 'string'
        }
      },
      'type': 'object'
    });
  });

  it('round-trips examples', () => {
    assertRoundTrip({
      '$id': 'https://rt.test/Examples',
      'examples': [
        'alpha',
        'beta'
      ],
      'type': 'string'
    });
  });

  it('round-trips nested examples on properties', () => {
    assertRoundTrip({
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
    });
  });
});

// ---------------------------------------------------------------------------
// 11. Dependencies
// ---------------------------------------------------------------------------

describe('Round-trip: dependencies', () => {
  it('round-trips dependentRequired', () => {
    assertRoundTrip({
      '$id': 'https://rt.test/DepRequired',
      'dependentRequired': { 'creditCard': ['billingAddress'] },
      'properties': {
        'billingAddress': { 'type': 'string' },
        'creditCard': { 'type': 'string' }
      },
      'type': 'object'
    });
  });

  it('round-trips dependentSchemas', () => {
    assertRoundTrip({
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
    });
  });
});

// ---------------------------------------------------------------------------
// 12. Discriminator
// ---------------------------------------------------------------------------

describe('Round-trip: discriminator', () => {
  it('round-trips discriminator with mapping', () => {
    assertRoundTrip({
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
    });
  });

  it('round-trips discriminator without mapping', () => {
    assertRoundTrip({
      '$id': 'https://rt.test/DiscNoMap',
      'discriminator': { 'propertyName': 'kind' },
      'oneOf': [{
        'properties': { 'kind': { 'const': 'a' } },
        'type': 'object'
      }]
    });
  });
});

// ---------------------------------------------------------------------------
// 13. Extension keywords (ontology)
// ---------------------------------------------------------------------------

describe('Round-trip: ontology extension keywords', () => {
  it('round-trips rdfs:domain and rdfs:range', () => {
    assertRoundTrip({
      '$id': 'https://rt.test/DomainRange',
      'rdfs:domain': 'https://example.com/Person',
      'rdfs:range': 'http://www.w3.org/2001/XMLSchema#string',
      'type': 'string'
    });
  });

  it('round-trips disjointWith', () => {
    assertRoundTrip({
      '$id': 'https://rt.test/Disjoint',
      'disjointWith': 'https://example.com/Cat',
      'properties': { 'name': { 'type': 'string' } },
      'type': 'object'
    });
  });

  it('round-trips equivalentTo', () => {
    assertRoundTrip({
      '$id': 'https://rt.test/Equivalent',
      'equivalentTo': 'https://example.com/Human',
      'type': 'object'
    });
  });

  it('round-trips inverseOf', () => {
    assertRoundTrip({
      '$id': 'https://rt.test/InverseOf',
      'properties': {
        'owns': {
          'inverseOf': 'https://example.com/Thing#ownedBy',
          'type': 'string'
        }
      },
      'type': 'object'
    });
  });

  it('round-trips transitive', () => {
    assertRoundTrip({
      '$id': 'https://rt.test/Transitive',
      'properties': {
        'ancestor': {
          'transitive': true,
          'type': 'string'
        }
      },
      'type': 'object'
    });
  });

  it('round-trips symmetric', () => {
    assertRoundTrip({
      '$id': 'https://rt.test/Symmetric',
      'properties': {
        'sibling': {
          'symmetric': true,
          'type': 'string'
        }
      },
      'type': 'object'
    });
  });
});

// ---------------------------------------------------------------------------
// 14. Custom / extension keywords (x-*)
// ---------------------------------------------------------------------------

describe('Round-trip: custom extension keywords', () => {
  it('round-trips x-* keywords on root', () => {
    assertRoundTrip({
      '$id': 'https://rt.test/CustomRoot',
      'evenNumber': true,
      'type': 'integer',
      'x-ui-widget': 'slider',
      'x-validation-group': 'pricing'
    });
  });

  it('round-trips x-* keywords on properties', () => {
    assertRoundTrip({
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
    });
  });
});

// ---------------------------------------------------------------------------
// 15. Boolean schemas
// ---------------------------------------------------------------------------

describe('Round-trip: boolean schemas', () => {
  it('round-trips boolean true as nested schema', () => {
    const schema: Record<string, unknown> = {
      '$id': 'https://rt.test/BoolTrue',
      'allOf': [true]
    };
    const graph = new SchemaGraph(schema);
    const rt = serializer.serialize(graph);

    assert.deepEqual(rt.allOf, [true]);
  });

  it('round-trips boolean false as nested schema', () => {
    const schema: Record<string, unknown> = {
      '$id': 'https://rt.test/BoolFalse',
      'allOf': [false]
    };
    const graph = new SchemaGraph(schema);
    const rt = serializer.serialize(graph);

    assert.deepEqual(rt.allOf, [false]);
  });

  it('round-trips unevaluatedProperties: false (boolean schema)', () => {
    assertRoundTrip({
      '$id': 'https://rt.test/UnevalPropsFalse',
      'properties': { 'name': { 'type': 'string' } },
      'type': 'object',
      'unevaluatedProperties': false
    });
  });

  it('round-trips items: false (boolean schema)', () => {
    assertRoundTrip({
      '$id': 'https://rt.test/ItemsFalse',
      'items': false,
      'prefixItems': [
        { 'type': 'string' },
        { 'type': 'number' }
      ],
      'type': 'array'
    });
  });
});

// ---------------------------------------------------------------------------
// 16. $schema and $vocabulary
// ---------------------------------------------------------------------------

describe('Round-trip: $schema and $vocabulary', () => {
  it('round-trips $schema dialect', () => {
    assertRoundTrip({
      '$id': 'https://rt.test/Dialect',
      '$schema': 'https://json-schema.org/draft/2020-12/schema',
      'properties': { 'name': { 'type': 'string' } },
      'type': 'object'
    });
  });

  it('round-trips $vocabulary', () => {
    assertRoundTrip({
      '$id': 'https://rt.test/Vocabulary',
      '$schema': 'https://json-schema.org/draft/2020-12/schema',
      '$vocabulary': {
        'https://json-schema.org/draft/2020-12/vocab/applicator': true,
        'https://json-schema.org/draft/2020-12/vocab/core': true,
        'https://json-schema.org/draft/2020-12/vocab/validation': true
      },
      'type': 'string'
    });
  });
});

// ---------------------------------------------------------------------------
// 17. Schemas from existing test suite
// ---------------------------------------------------------------------------

describe('Round-trip: schemas from existing tests', () => {
  it('round-trips PersonSchema (compose.test)', () => {
    assertRoundTrip({
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
    });
  });

  it('round-trips AddressSchema (compose.test)', () => {
    assertRoundTrip({
      '$id': 'https://example.io/address',
      'properties': {
        'city': { 'type': 'string' },
        'street': { 'type': 'string' }
      },
      'required': ['street'],
      'type': 'object'
    });
  });

  it('round-trips ConfigSchema (materializer.test)', () => {
    assertRoundTrip({
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
    });
  });

  it('round-trips NestedSchema (materializer.test)', () => {
    assertRoundTrip({
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
    });
  });

  it('round-trips StrictSchema (materializer.test)', () => {
    assertRoundTrip({
      '$id': 'https://example.io/strict',
      '$schema': 'https://json-schema.org/draft/2020-12/schema',
      'additionalProperties': false,
      'properties': {
        'name': { 'type': 'string' },
        'value': { 'type': 'number' }
      },
      'required': ['name'],
      'type': 'object'
    });
  });

  it('round-trips UserSchema (jsonTology.test)', () => {
    assertRoundTrip({
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
    });
  });

  it('round-trips DirectorySchema (jsonTology.test)', () => {
    assertRoundTrip({
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
    });
  });

  it('round-trips DateTimeSchema (transform.test)', () => {
    assertRoundTrip({
      '$id': 'https://myapp.io/DateTime',
      'format': 'date-time',
      'type': 'string'
    });
  });

  it('round-trips PersonSchema with domain/range (domainRange.test)', () => {
    assertRoundTrip({
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
    });
  });

  it('round-trips GraphNodeSchema (ontologyBuilder.test - transitive+symmetric)', () => {
    assertRoundTrip({
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
    });
  });

  it('round-trips schema with escaped JSON pointer key', () => {
    // The schema has a property key with "/" which exercises JSON pointer escaping
    assertRoundTrip({
      '$defs': {
        'address': {
          'properties': { 'street/name': { 'type': 'string' } },
          'type': 'object'
        }
      },
      '$id': 'https://rt.test/EscapedPointer',
      'properties': { 'address': { '$ref': '#/$defs/address' } },
      'type': 'object'
    });
  });
});

// ---------------------------------------------------------------------------
// 18. Complex combined schemas
// ---------------------------------------------------------------------------

describe('Round-trip: complex combined schemas', () => {
  it('round-trips schema with all constraint types combined', () => {
    assertRoundTrip({
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
    });
  });

  it('round-trips schema with composition + conditionals + refs', () => {
    assertRoundTrip({
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
      'then': { 'required': ['base'] },
      'type': 'object'
    });
  });

  it('round-trips schema with dependentRequired + dependentSchemas + patternProperties', () => {
    assertRoundTrip({
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
    });
  });

  it('round-trips schema with unevaluatedProperties + conditional + allOf', () => {
    assertRoundTrip({
      '$id': 'https://rt.test/UnevalConditional',
      'else': { 'properties': { 'bValue': { 'type': 'string' } } },
      'if': { 'properties': { 'kind': { 'const': 'a' } } },
      'properties': { 'kind': { 'type': 'string' } },
      'required': ['kind'],
      'then': { 'properties': { 'aValue': { 'type': 'number' } } },
      'type': 'object',
      'unevaluatedProperties': false
    });
  });
});

// ---------------------------------------------------------------------------
// 19. Idempotency verification
// ---------------------------------------------------------------------------

describe('Round-trip: idempotency', () => {
  it('three consecutive round-trips produce identical output', () => {
    const schema: Record<string, unknown> = {
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

    const rt1 = roundtrip(schema);
    const rt2 = roundtrip(rt1);
    const rt3 = roundtrip(rt2);

    assert.deepEqual(rt1, schema);
    assert.deepEqual(rt2, rt1);
    assert.deepEqual(rt3, rt2);
  });
});
