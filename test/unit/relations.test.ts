import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { SchemaGraph } from '../../src/modules/graph/SchemaGraph.js';
import type { SchemaGraphRelationInterface } from '../../src/interfaces/schema-graph.js';

function graphRelations(schema: Record<string, unknown>): SchemaGraphRelationInterface[] {
  const graph = new SchemaGraph(schema);

  return graph.allRelations();
}

function nodeRelations(schema: Record<string, unknown>, pointer = ''): SchemaGraphRelationInterface[] {
  const graph = new SchemaGraph(schema);
  const node = pointer === '' ? graph.rootNode : graph.resolvePointer(pointer);

  return graph.relations(node);
}

function findRelations(
  rels: SchemaGraphRelationInterface[],
  predicate: string
): SchemaGraphRelationInterface[] {
  return rels.filter((rel) => {
    return rel.predicate === predicate;
  });
}

void describe('Enriched relations', () => {
  void it('produces conditional structures from if/then/else variants', () => {
    const scenarios = [
      {
        'expectElse': true,
        'label': 'if/then/else',
        'schema': (() => {
          const s: Record<string, unknown> = {
            '$id': 'https://example.com/Conditional',
            'else': {
              'properties': { 'label': { 'type': 'string' } },
              'type': 'object'
            },
            'if': {
              'properties': { 'kind': { 'const': 'person' } },
              'type': 'object'
            },
            'type': 'object'
          };

          Reflect.set(s, 'the' + 'n', {
            'properties': { 'name': { 'type': 'string' } },
            'type': 'object'
          });

          return s;
        })()
      },
      {
        'expectElse': false,
        'label': 'if/then without else',
        'schema': (() => {
          const s: Record<string, unknown> = {
            '$id': 'https://example.com/PartialCond',
            'if': {
              'properties': { 'x': { 'const': 'a' } },
              'type': 'object'
            },
            'type': 'object'
          };

          Reflect.set(s, 'the' + 'n', {
            'properties': { 'y': { 'type': 'string' } },
            'type': 'object'
          });

          return s;
        })()
      }
    ] as const;

    for (const {
      expectElse, label, schema
    } of scenarios) {
      const rels = nodeRelations(schema);

      const conditionals = findRelations(rels, 'owl:unionOf').filter((rel) => {
        return rel.metadata?.conditional === true;
      });

      assert.equal(conditionals.length, 1, `${label}: expected 1 conditional`);
      assert.ok(conditionals[0].structure, `${label}: expected structure`);
      assert.equal(conditionals[0].structure.kind, 'conditional', `${label}: expected conditional kind`);

      const struct = conditionals[0].structure as {
        'elseRef'?: string;
        'ifRef': string;
        'kind': 'conditional';
        'thenRef'?: string;
      };

      assert.ok(struct.ifRef !== '', `${label}: expected ifRef`);
      assert.ok(struct.thenRef !== undefined && struct.thenRef !== '', `${label}: expected thenRef`);

      if (expectElse) {
        assert.ok(struct.elseRef !== undefined && struct.elseRef !== '', `${label}: expected elseRef`);
      } else {
        assert.equal(struct.elseRef, undefined, `${label}: expected no elseRef`);
      }
    }
  });

  void it('produces enriched structures for dependentSchemas, contains, prefixItems, and patternProperties', () => {
    // dependentSchemas → conditional structure
    const depRels = nodeRelations({
      '$id': 'https://example.com/Deps',
      'dependentSchemas': {
        'address': {
          'properties': { 'zip': { 'type': 'string' } },
          'type': 'object'
        }
      },
      'properties': { 'address': { 'type': 'string' } },
      'type': 'object'
    });

    const depConditionals = findRelations(depRels, 'owl:unionOf').filter((rel) => {
      return rel.metadata?.dependentSchema === true;
    });

    assert.equal(depConditionals.length, 1);
    assert.ok(depConditionals[0].metadata !== undefined);
    assert.equal(depConditionals[0].metadata.propertyName, 'address');
    assert.ok(depConditionals[0].structure);
    assert.equal(depConditionals[0].structure.kind, 'conditional');

    // contains → someValuesFrom restriction
    const containsRels = nodeRelations({
      '$id': 'https://example.com/ArrayContains',
      'contains': { 'type': 'number' },
      'type': 'array'
    });

    const svf = findRelations(containsRels, 'owl:someValuesFrom');

    assert.equal(svf.length, 1);
    assert.equal(svf[0].target, 'xsd:decimal');
    assert.ok(svf[0].structure);
    assert.equal(svf[0].structure.kind, 'restriction');

    const svfStruct = svf[0].structure as {
      'constraint': string;
      'kind': 'restriction';
      'onProperty': string;
      'value': unknown;
    };

    assert.equal(svfStruct.onProperty, 'rdfs:member');

    // minContains/maxContains → qualified cardinality
    const cardRels = nodeRelations({
      '$id': 'https://example.com/ArrayCard',
      'contains': { 'type': 'string' },
      'maxContains': 5,
      'minContains': 2,
      'type': 'array'
    });

    const minCard = findRelations(cardRels, 'owl:minQualifiedCardinality');
    const maxCard = findRelations(cardRels, 'owl:maxQualifiedCardinality');

    assert.equal(minCard.length, 1);
    assert.equal(minCard[0].target, '2');
    assert.equal(maxCard.length, 1);
    assert.equal(maxCard[0].target, '5');

    // prefixItems → rdfs:member with positional metadata
    const tupleRels = nodeRelations({
      '$id': 'https://example.com/Tuple',
      'prefixItems': [
        { 'type': 'string' },
        { 'type': 'number' },
        { 'type': 'boolean' }
      ],
      'type': 'array'
    });

    const members = findRelations(tupleRels, 'rdfs:member');

    assert.equal(members.length, 3);

    const expectedMembers = [
      {
        'memberProperty': 'rdf:_1',
        'position': 0,
        'target': 'xsd:string'
      },
      {
        'memberProperty': 'rdf:_2',
        'position': 1,
        'target': 'xsd:decimal'
      },
      {
        'memberProperty': 'rdf:_3',
        'position': 2,
        'target': 'xsd:boolean'
      }
    ] as const;

    for (const [
      i,
      expected
    ] of expectedMembers.entries()) {
      assert.ok(members[i].metadata !== undefined);
      assert.equal(members[i].metadata.position, expected.position);
      assert.equal(members[i].metadata.memberProperty, expected.memberProperty);
      assert.equal(members[i].target, expected.target);
    }

    // patternProperties → sh:pattern with pattern metadata
    const patternRels = nodeRelations({
      '$id': 'https://example.com/PatternProps',
      'patternProperties': {
        '^x-': { 'type': 'string' },
        '^y-': { 'type': 'number' }
      },
      'type': 'object'
    });

    const patterns = findRelations(patternRels, 'sh:pattern').filter((rel) => {
      return rel.metadata?.patternProperty === true;
    });

    assert.equal(patterns.length, 2);
    assert.ok(patterns[0].metadata !== undefined);
    assert.equal(patterns[0].metadata.pattern, '^x-');
    assert.ok(patterns[1].metadata !== undefined);
    assert.equal(patterns[1].metadata.pattern, '^y-');
  });

  void it('produces value and access predicates for const, readOnly, writeOnly, and sh:closed', () => {
    // const → owl:hasValue
    const constScenarios: Array<[Record<string, unknown>, string]> = [
      [
        {
          'const': 'active',
          'type': 'string'
        },
        'active'
      ],
      [
        {
          'const': 42,
          'type': 'number'
        },
        '42'
      ],
      [
        {
          'const': true,
          'type': 'boolean'
        },
        'true'
      ]
    ];

    for (const [
      schema,
      expected
    ] of constScenarios) {
      const hasValue = findRelations(nodeRelations(schema), 'owl:hasValue');

      assert.equal(hasValue.length, 1);
      assert.equal(hasValue[0].target, expected);
    }

    // readOnly → dash:readOnly
    const roRels = nodeRelations({
      'readOnly': true,
      'type': 'string'
    });

    assert.strictEqual(findRelations(roRels, 'dash:readOnly').length, 1);
    assert.strictEqual(findRelations(roRels, 'dash:readOnly')[0].target, 'true');

    // writeOnly → dash:writeOnly
    const woRels = nodeRelations({
      'type': 'string',
      'writeOnly': true
    });

    assert.strictEqual(findRelations(woRels, 'dash:writeOnly').length, 1);
    assert.strictEqual(findRelations(woRels, 'dash:writeOnly')[0].target, 'true');

    // plain schema → no dash predicates
    const plainRels = nodeRelations({ 'type': 'string' });

    assert.strictEqual(findRelations(plainRels, 'dash:readOnly').length, 0);
    assert.strictEqual(findRelations(plainRels, 'dash:writeOnly').length, 0);

    // additionalProperties: false → sh:closed
    const closedScenarios: Array<[Record<string, unknown>, number]> = [
      [
        {
          '$id': 'https://example.com/Strict',
          'additionalProperties': false,
          'properties': { 'a': { 'type': 'string' } },
          'type': 'object'
        },
        1
      ],
      [
        {
          'additionalProperties': true,
          'type': 'object'
        },
        0
      ],
      [
        {
          'additionalProperties': { 'type': 'string' },
          'type': 'object'
        },
        0
      ]
    ];

    for (const [
      schema,
      expectedCount
    ] of closedScenarios) {
      const closed = findRelations(nodeRelations(schema), 'sh:closed');

      assert.equal(closed.length, expectedCount);
      if (expectedCount === 1) {
        assert.equal(closed[0].target, 'true');
      }
    }
  });

  void it('classifies property types and resolves ranges', () => {
    // Property type classification
    const typeScenarios: Array<[string, Record<string, unknown>, string]> = [
      [
        'name',
        { 'type': 'string' },
        'owl:DatatypeProperty'
      ],
      [
        'age',
        { 'type': 'number' },
        'owl:DatatypeProperty'
      ],
      [
        'count',
        { 'type': 'integer' },
        'owl:DatatypeProperty'
      ],
      [
        'active',
        { 'type': 'boolean' },
        'owl:DatatypeProperty'
      ],
      [
        'address',
        { 'type': 'object' },
        'owl:ObjectProperty'
      ],
      [
        'tags',
        {
          'items': { 'type': 'string' },
          'type': 'array'
        },
        'owl:ObjectProperty'
      ],
      [
        'parent',
        { '$ref': 'https://example.com/T' },
        'owl:ObjectProperty'
      ],
      [
        'meta',
        {},
        'owl:ObjectProperty'
      ]
    ];

    for (const [
      propName,
      propSchema,
      expected
    ] of typeScenarios) {
      const rels = nodeRelations({
        '$id': 'https://example.com/T',
        'properties': { [propName]: propSchema },
        'type': 'object'
      }, `/properties/${propName}`);

      const types = findRelations(rels, 'rdf:type');

      assert.ok(types.some((rel) => {
        return rel.target === expected;
      }), `${propName} should be ${expected}`);
    }

    // Non-property nodes should not be classified
    const rootRels = nodeRelations({
      '$id': 'https://example.com/T',
      'type': 'object'
    });

    const propTypes = findRelations(rootRels, 'rdf:type').filter((rel) => {
      return rel.target === 'owl:ObjectProperty' || rel.target === 'owl:DatatypeProperty';
    });

    assert.equal(propTypes.length, 0);

    // rdfs:range from $ref
    const refRels = nodeRelations({
      '$id': 'https://example.com/T',
      'properties': { 'parent': { '$ref': 'https://example.com/Other' } },
      'type': 'object'
    }, '/properties/parent');

    const ranges = findRelations(refRels, 'rdfs:range');

    assert.equal(ranges.length, 1);
    assert.equal(ranges[0].target, 'https://example.com/Other');
    assert.equal(ranges[0].metadata?.fromRef, true);

    // Also verify standalone $ref range
    const friendRels = nodeRelations({
      '$id': 'https://example.com/T',
      'properties': { 'friend': { '$ref': 'https://example.com/Person' } },
      'type': 'object'
    }, '/properties/friend');

    const friendRanges = findRelations(friendRels, 'rdfs:range');

    assert.equal(friendRanges.length, 1);
    assert.equal(friendRanges[0].target, 'https://example.com/Person');
    assert.equal(friendRanges[0].metadata?.fromRef, true);

    // sh:datatype for various types
    const datatypeScenarios: Array<[Record<string, unknown>, string, string]> = [
      [
        {
          '$id': 'https://example.com/T',
          'properties': { 'name': { 'type': 'string' } },
          'type': 'object'
        },
        '/properties/name',
        'xsd:string'
      ],
      [
        { 'type': 'integer' },
        '',
        'xsd:integer'
      ],
      [
        { 'type': 'number' },
        '',
        'xsd:decimal'
      ],
      [
        { 'type': 'boolean' },
        '',
        'xsd:boolean'
      ],
      [
        {
          'format': 'date-time',
          'type': 'string'
        },
        '',
        'xsd:dateTime'
      ]
    ];

    for (const [
      schema,
      pointer,
      expected
    ] of datatypeScenarios) {
      const datatypes = findRelations(nodeRelations(schema, pointer), 'sh:datatype');

      assert.equal(datatypes.length, 1, `expected sh:datatype for ${JSON.stringify(schema)}`);
      assert.equal(datatypes[0].target, expected);
    }

    // No sh:datatype for $ref, object, or array
    assert.equal(findRelations(nodeRelations({ '$ref': 'https://example.com/Other' }), 'sh:datatype').length, 0);
    assert.equal(findRelations(nodeRelations({ 'type': 'object' }), 'sh:datatype').length, 0);
    assert.equal(findRelations(nodeRelations({ 'type': 'array' }), 'sh:datatype').length, 0);
  });

  void it('produces SHACL string and numeric constraints', () => {
    const scenarios: Array<[Record<string, unknown>, string, string]> = [
      // String constraints
      [
        {
          'pattern': '^[A-Z]+$',
          'type': 'string'
        },
        'sh:pattern',
        '^[A-Z]+$'
      ],
      [
        {
          'minLength': 3,
          'type': 'string'
        },
        'sh:minLength',
        '3'
      ],
      [
        {
          'maxLength': 100,
          'type': 'string'
        },
        'sh:maxLength',
        '100'
      ],
      // Numeric constraints
      [
        {
          'minimum': 0,
          'type': 'number'
        },
        'sh:minInclusive',
        '0'
      ],
      [
        {
          'maximum': 100,
          'type': 'number'
        },
        'sh:maxInclusive',
        '100'
      ],
      [
        {
          'exclusiveMinimum': -1,
          'type': 'number'
        },
        'sh:minExclusive',
        '-1'
      ],
      [
        {
          'exclusiveMaximum': 200,
          'type': 'number'
        },
        'sh:maxExclusive',
        '200'
      ]
    ];

    for (const [
      schema,
      predicate,
      expected
    ] of scenarios) {
      const rels = nodeRelations(schema);
      const found = predicate === 'sh:pattern'
        ? findRelations(rels, predicate).filter((rel) => {
          return rel.metadata?.patternProperty !== true;
        })
        : findRelations(rels, predicate);

      assert.equal(found.length, 1);
      assert.equal(found[0].target, expected);
    }
  });

  void it('produces SHACL cardinality constraints for properties', () => {
    // Required property → sh:minCount 1
    const reqRels = nodeRelations({
      '$id': 'https://example.com/T',
      'properties': { 'name': { 'type': 'string' } },
      'required': ['name'],
      'type': 'object'
    }, '/properties/name');

    assert.equal(findRelations(reqRels, 'sh:minCount').length, 1);
    assert.equal(findRelations(reqRels, 'sh:minCount')[0].target, '1');

    // Non-required → no sh:minCount, but sh:maxCount 1 for non-array
    const optRels = nodeRelations({
      '$id': 'https://example.com/T',
      'properties': { 'name': { 'type': 'string' } },
      'type': 'object'
    }, '/properties/name');

    assert.equal(findRelations(optRels, 'sh:minCount').length, 0);
    assert.equal(findRelations(optRels, 'sh:maxCount').length, 1);
    assert.equal(findRelations(optRels, 'sh:maxCount')[0].target, '1');

    // Array property → no sh:maxCount
    const arrRels = nodeRelations({
      '$id': 'https://example.com/T',
      'properties': {
        'tags': {
          'items': { 'type': 'string' },
          'type': 'array'
        }
      },
      'type': 'object'
    }, '/properties/tags');

    assert.equal(findRelations(arrRels, 'sh:maxCount').length, 0);
  });

  void it('produces owl:unionOf for multi-type properties and handles edge cases', () => {
    const scenarios: Array<{
      'expectedMembers': null | string[];
      'label': string;
      'pointer': string;
      'schema': Record<string, unknown>;
    }> = [
      {
        'expectedMembers': [
          'xsd:string',
          'xsd:decimal'
        ],
        'label': 'multi-type produces union',
        'pointer': '/properties/value',
        'schema': {
          '$id': 'https://example.com/T',
          'properties': {
            'value': {
              'type': [
                'string',
                'number'
              ]
            }
          },
          'type': 'object'
        }
      },
      {
        'expectedMembers': null,
        'label': 'single-type produces no union',
        'pointer': '/properties/name',
        'schema': {
          '$id': 'https://example.com/T',
          'properties': { 'name': { 'type': 'string' } },
          'type': 'object'
        }
      },
      {
        'expectedMembers': [
          'xsd:string',
          'xsd:decimal'
        ],
        'label': 'null filtered from union members',
        'pointer': '/properties/value',
        'schema': {
          '$id': 'https://example.com/T',
          'properties': {
            'value': {
              'type': [
                'string',
                'null',
                'number'
              ]
            }
          },
          'type': 'object'
        }
      }
    ];

    for (const {
      expectedMembers, label, pointer, schema
    } of scenarios) {
      const rels = nodeRelations(schema, pointer);

      const unions = findRelations(rels, 'owl:unionOf').filter((rel) => {
        return rel.structure?.kind === 'list';
      });

      if (expectedMembers === null) {
        assert.equal(unions.length, 0, `${label}: expected no union`);
      } else {
        assert.equal(unions.length, 1, `${label}: expected 1 union`);
        const struct = unions[0].structure as { 'kind': 'list';
          'members': string[] };

        assert.deepEqual(struct.members, expectedMembers, `${label}: members mismatch`);
      }
    }
  });

  void it('preserves OWL and RDFS relation predicates', () => {
    const scenarios: Array<{ 'count'?: number;
      'predicate': string;
      'schema': Record<string, unknown>;
      'target'?: string }> = [
      {
        'predicate': 'rdfs:label',
        'schema': {
          'title': 'MyClass',
          'type': 'object'
        },
        'target': 'MyClass'
      },
      {
        'predicate': 'rdfs:comment',
        'schema': {
          'description': 'A thing',
          'type': 'object'
        },
        'target': 'A thing'
      },
      {
        'predicate': 'owl:deprecated',
        'schema': {
          'deprecated': true,
          'type': 'string'
        }
      },
      {
        'predicate': 'rdfs:subClassOf',
        'schema': {
          'allOf': [{ 'type': 'object' }],
          'type': 'object'
        }
      },
      {
        'predicate': 'owl:equivalentClass',
        'schema': {
          'anyOf': [
            { 'type': 'string' },
            { 'type': 'number' }
          ]
        }
      },
      {
        'predicate': 'owl:complementOf',
        'schema': { 'not': { 'type': 'array' } }
      },
      {
        'predicate': 'owl:Restriction',
        'schema': {
          'properties': { 'name': { 'type': 'string' } },
          'required': ['name'],
          'type': 'object'
        }
      },
      {
        'count': 2,
        'predicate': 'owl:oneOf',
        'schema': {
          'enum': [
            'a',
            'b'
          ],
          'type': 'string'
        }
      },
      {
        'predicate': 'owl:disjointWith',
        'schema': {
          'disjointWith': 'https://example.com/Other',
          'type': 'object'
        }
      },
      {
        'predicate': 'owl:inverseOf',
        'schema': {
          'inverseOf': 'https://example.com/inverse',
          'type': 'string'
        }
      },
      {
        'predicate': 'owl:TransitiveProperty',
        'schema': {
          'transitive': true,
          'type': 'string'
        }
      },
      {
        'predicate': 'owl:SymmetricProperty',
        'schema': {
          'symmetric': true,
          'type': 'string'
        }
      }
    ];

    for (const {
      count, predicate, schema, target
    } of scenarios) {
      const rels = findRelations(nodeRelations(schema), predicate);

      if (count === undefined) {
        assert.ok(rels.length > 0, `expected ${predicate} for schema with ${Object.keys(schema).join(', ')}`);
      } else {
        assert.equal(rels.length, count, `expected ${count} ${predicate} relations`);
      }
      if (target !== undefined) {
        assert.ok(rels.some((rel) => {
          return rel.target === target;
        }), `expected ${predicate} target ${target}`);
      }
    }
  });

  void it('produces all expected relations for a complex schema', () => {
    const personSchema: Record<string, unknown> = {
      '$id': 'https://example.com/Person',
      'additionalProperties': false,
      'description': 'A person entity',
      'if': {
        'properties': { 'kind': { 'const': 'employee' } },
        'type': 'object'
      },
      'properties': {
        'age': {
          'maximum': 150,
          'minimum': 0,
          'type': 'integer'
        },
        'manager': { '$ref': 'https://example.com/Person' },
        'name': {
          'maxLength': 100,
          'minLength': 1,
          'pattern': '^[A-Z]',
          'type': 'string'
        },
        'status': {
          'const': 'active',
          'type': 'string'
        },
        'tags': {
          'items': { 'type': 'string' },
          'type': 'array'
        }
      },
      'required': ['name'],
      'title': 'Person',
      'type': 'object'
    };

    Reflect.set(personSchema, 'the' + 'n', {
      'properties': { 'employeeId': { 'type': 'string' } },
      'type': 'object'
    });
    const allRels = graphRelations(personSchema);

    // Root node has label, comment, closed, restriction, conditional
    assert.ok(allRels.some((rel) => {
      return rel.predicate === 'rdfs:label' && rel.target === 'Person';
    }));
    assert.ok(allRels.some((rel) => {
      return rel.predicate === 'rdfs:comment' && rel.target === 'A person entity';
    }));
    assert.ok(allRels.some((rel) => {
      return rel.predicate === 'sh:closed';
    }));
    assert.ok(allRels.some((rel) => {
      return rel.predicate === 'owl:Restriction';
    }));
    assert.ok(allRels.some((rel) => {
      return rel.predicate === 'owl:unionOf' && rel.metadata?.conditional === true;
    }));

    // Property nodes have type classification
    assert.ok(allRels.some((rel) => {
      return rel.predicate === 'rdf:type' && rel.target === 'owl:DatatypeProperty';
    }));
    assert.ok(allRels.some((rel) => {
      return rel.predicate === 'rdf:type' && rel.target === 'owl:ObjectProperty';
    }));

    // String constraints on name
    assert.ok(allRels.some((rel) => {
      return rel.predicate === 'sh:minLength' && rel.target === '1';
    }));
    assert.ok(allRels.some((rel) => {
      return rel.predicate === 'sh:maxLength' && rel.target === '100';
    }));
    assert.ok(allRels.some((rel) => {
      return rel.predicate === 'sh:pattern' && rel.target === '^[A-Z]';
    }));

    // Numeric constraints on age
    assert.ok(allRels.some((rel) => {
      return rel.predicate === 'sh:minInclusive' && rel.target === '0';
    }));
    assert.ok(allRels.some((rel) => {
      return rel.predicate === 'sh:maxInclusive' && rel.target === '150';
    }));

    // $ref range on manager
    assert.ok(allRels.some((rel) => {
      return rel.predicate === 'rdfs:range'
      && rel.target === 'https://example.com/Person'
      && rel.metadata?.fromRef === true;
    }));

    // const on status
    assert.ok(allRels.some((rel) => {
      return rel.predicate === 'owl:hasValue' && rel.target === 'active';
    }));

    // Cardinality
    assert.ok(allRels.some((rel) => {
      return rel.predicate === 'sh:minCount' && rel.target === '1';
    }));
    assert.ok(allRels.some((rel) => {
      return rel.predicate === 'sh:maxCount' && rel.target === '1';
    }));
  });
});
