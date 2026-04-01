import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { SchemaGraph } from '../../src/modules/graph/schemaGraph.js';
import {
  projectAbox, projectGraph, quadsToJsonLdNodes
} from '../../src/modules/rdf/projection.js';
import type { QuadInterface } from '../../src/interfaces/Quad.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findQuads(quads: QuadInterface[], predicate: string): QuadInterface[] {
  return quads.filter((quad) => {
    return quad.predicate === predicate;
  });
}

function findQuadsForSubject(quads: QuadInterface[], subject: string, predicate: string): QuadInterface[] {
  return quads.filter((quad) => {
    return quad.subject === subject && quad.predicate === predicate;
  });
}

function hasIriQuad(quads: QuadInterface[], subject: string, predicate: string, objectIri: string): boolean {
  return quads.some((quad) => {
    return quad.subject === subject
    && quad.predicate === predicate
    && quad.object.termType === 'NamedNode'
    && quad.object.value === objectIri;
  });
}

// eslint-disable-next-line @stylistic/max-len
function hasLiteralQuad(quads: QuadInterface[], subject: string, predicate: string, value: unknown, datatype?: string): boolean {
  return quads.some((quad) => {
    return quad.subject === subject
    && quad.predicate === predicate
    && quad.object.termType === 'Literal'
    && quad.object.value === value
    && (datatype === undefined || quad.object.datatype.value === datatype);
  });
}

function hasBnodeQuad(quads: QuadInterface[], subject: string, predicate: string): QuadInterface | undefined {
  return quads.find((quad) => {
    return quad.subject === subject
    && quad.predicate === predicate
    && quad.object.termType === 'BlankNode';
  });
}

function bnodeId(quad: QuadInterface): string {
  if (quad.object.termType === 'BlankNode') {
    return quad.object.value;
  }
  throw new Error('Expected bnode object');
}

function tboxQuads(schema: Record<string, unknown>): QuadInterface[] {
  const graph = new SchemaGraph(schema);

  return projectGraph(graph);
}

// ---------------------------------------------------------------------------
// TBox tests
// ---------------------------------------------------------------------------

void describe('projectGraph — TBox projection', () => {
  void it('emits class, property, domain, and required-restriction quads', () => {
    const quads = tboxQuads({
      '$id': 'https://example.com/Person',
      'properties': {
        'age': { 'type': 'integer' },
        'name': { 'type': 'string' }
      },
      'type': 'object'
    });

    assert.ok(hasIriQuad(quads, 'https://example.com/Person', 'rdf:type', 'owl:Class'));
    assert.ok(hasIriQuad(
      quads,
      'https://example.com/Person#/properties/name',
      'rdf:type',
      'owl:DatatypeProperty'
    ));
    assert.ok(hasIriQuad(
      quads,
      'https://example.com/Person#/properties/age',
      'rdf:type',
      'owl:DatatypeProperty'
    ));
    assert.ok(hasIriQuad(
      quads,
      'https://example.com/Person#/properties/name',
      'rdfs:domain',
      'https://example.com/Person'
    ));

    // required properties produce owl:Restriction with minCardinality
    const reqQuads = tboxQuads({
      '$id': 'https://example.com/Person',
      'properties': { 'name': { 'type': 'string' } },
      'required': ['name'],
      'type': 'object'
    });

    const restrictionLink = hasBnodeQuad(reqQuads, 'https://example.com/Person', 'rdfs:subClassOf');

    assert.ok(restrictionLink, 'should have restriction bnode');

    const bId = bnodeId(restrictionLink);

    assert.ok(hasIriQuad(reqQuads, bId, 'rdf:type', 'owl:Restriction'));
    assert.ok(hasIriQuad(reqQuads, bId, 'owl:onProperty', 'https://example.com/Person#name'));
    assert.ok(hasLiteralQuad(reqQuads, bId, 'owl:minCardinality', 1, 'xsd:nonNegativeInteger'));
    assert.ok(hasLiteralQuad(
      reqQuads,
      'https://example.com/Person#/properties/name',
      'sh:minCount',
      1,
      'xsd:integer'
    ));
  });

  void it('string and numeric constraint quads', () => {
    const scenarios = [
      {
        'assertions': [
          {
            'datatype': 'xsd:integer',
            'predicate': 'sh:minLength',
            'subject': 'https://example.com/T#/properties/code',
            'value': 2
          },
          {
            'datatype': 'xsd:integer',
            'predicate': 'sh:maxLength',
            'subject': 'https://example.com/T#/properties/code',
            'value': 10
          },
          {
            'datatype': 'xsd:string',
            'predicate': 'sh:pattern',
            'subject': 'https://example.com/T#/properties/code',
            'value': '^[A-Z]+$'
          }
        ],
        'schema': {
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
        }
      },
      {
        'assertions': [
          {
            'datatype': 'xsd:decimal',
            'predicate': 'sh:minInclusive',
            'subject': 'https://example.com/T#/properties/score',
            'value': 0
          },
          {
            'datatype': 'xsd:decimal',
            'predicate': 'sh:maxInclusive',
            'subject': 'https://example.com/T#/properties/score',
            'value': 100
          },
          {
            'datatype': 'xsd:decimal',
            'predicate': 'sh:minExclusive',
            'subject': 'https://example.com/T#/properties/delta',
            'value': -1
          },
          {
            'datatype': 'xsd:decimal',
            'predicate': 'sh:maxExclusive',
            'subject': 'https://example.com/T#/properties/delta',
            'value': 200
          }
        ],
        'schema': {
          '$id': 'https://example.com/T',
          'properties': {
            'delta': {
              'exclusiveMaximum': 200,
              'exclusiveMinimum': -1,
              'type': 'number'
            },
            'score': {
              'maximum': 100,
              'minimum': 0,
              'type': 'number'
            }
          },
          'type': 'object'
        }
      }
    ] as const;

    for (const scenario of scenarios) {
      const quads = tboxQuads(scenario.schema as Record<string, unknown>);

      for (const assertion of scenario.assertions) {
        assert.ok(
          hasLiteralQuad(quads, assertion.subject, assertion.predicate, assertion.value, assertion.datatype),
          `expected ${assertion.predicate} = ${assertion.value} on ${assertion.subject}`
        );
      }
    }
  });

  void it('enum produces owl:oneOf, const produces owl:hasValue', () => {
    // enum
    const enumQuads = tboxQuads({
      '$id': 'https://example.com/Status',
      'enum': [
        'active',
        'inactive',
        'pending'
      ],
      'type': 'string'
    });

    const oneOfQuads = findQuadsForSubject(enumQuads, 'https://example.com/Status', 'owl:oneOf');

    assert.equal(oneOfQuads.length, 3);
    assert.ok(hasLiteralQuad(enumQuads, 'https://example.com/Status', 'owl:oneOf', 'active', 'xsd:string'));
    assert.ok(hasLiteralQuad(enumQuads, 'https://example.com/Status', 'owl:oneOf', 'inactive', 'xsd:string'));
    assert.ok(hasLiteralQuad(enumQuads, 'https://example.com/Status', 'owl:oneOf', 'pending', 'xsd:string'));

    // const
    const constQuads = tboxQuads({
      '$id': 'https://example.com/Const',
      'const': 'fixed',
      'type': 'string'
    });

    assert.ok(hasLiteralQuad(constQuads, 'https://example.com/Const', 'owl:hasValue', 'fixed', 'xsd:string'));
  });

  void it('composition keywords: allOf, anyOf, oneOf, not', () => {
    // allOf -> rdfs:subClassOf
    const allOfQuads = tboxQuads({
      '$id': 'https://example.com/Child',
      'allOf': [{ '$ref': 'https://example.com/Parent' }],
      'type': 'object'
    });

    assert.ok(hasIriQuad(allOfQuads, 'https://example.com/Child', 'rdfs:subClassOf', 'https://example.com/Parent'));

    // anyOf/oneOf -> owl:equivalentClass
    const eqScenarios = [
      {
        'schema': {
          '$id': 'https://example.com/Union',
          'anyOf': [
            { 'type': 'string' },
            { 'type': 'number' }
          ]
        },
        'subject': 'https://example.com/Union'
      },
      {
        'schema': {
          '$id': 'https://example.com/Exclusive',
          'oneOf': [
            { 'type': 'string' },
            { 'type': 'boolean' }
          ]
        },
        'subject': 'https://example.com/Exclusive'
      }
    ] as const;

    for (const scenario of eqScenarios) {
      const quads = tboxQuads(scenario.schema as Record<string, unknown>);
      const eqQuads = findQuadsForSubject(quads, scenario.subject, 'owl:equivalentClass');

      assert.ok(eqQuads.length >= 2, `expected >= 2 owl:equivalentClass quads for ${scenario.subject}`);
    }

    // not -> owl:complementOf
    const notQuads = tboxQuads({
      '$id': 'https://example.com/NotArray',
      'not': { 'type': 'array' }
    });

    const compQuads = findQuadsForSubject(notQuads, 'https://example.com/NotArray', 'owl:complementOf');

    assert.ok(compQuads.length > 0);
  });

  void it('conditionals: if/then/else and dependentSchemas produce bnodes', () => {
    // if/then/else produces owl:unionOf bnode with jt: predicates
    const quads = tboxQuads({
      '$id': 'https://example.com/Conditional',
      'else': {
        'properties': { 'label': { 'type': 'string' } },
        'type': 'object'
      },
      'if': {
        'properties': { 'kind': { 'const': 'person' } },
        'type': 'object'
      },
      // eslint-disable-next-line unicorn/no-thenable -- JSON Schema 'then' keyword
      'then': {
        'properties': { 'name': { 'type': 'string' } },
        'type': 'object'
      },
      'type': 'object'
    });

    const unionQuad = hasBnodeQuad(quads, 'https://example.com/Conditional', 'owl:unionOf');

    assert.ok(unionQuad, 'should have conditional bnode');

    const bId = bnodeId(unionQuad);

    assert.ok(hasIriQuad(quads, bId, 'rdf:type', 'owl:Class'));

    for (const pred of [
      'jt:if',
      'jt:then',
      'jt:else'
    ] as const) {
      const found = findQuadsForSubject(quads, bId, pred);

      assert.ok(found.length > 0, `should have ${pred}`);
    }

    // dependentSchemas produce conditional bnode with jt:if
    const depQuads = tboxQuads({
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

    const depUnionQuad = hasBnodeQuad(depQuads, 'https://example.com/Deps', 'owl:unionOf');

    assert.ok(depUnionQuad, 'should have conditional bnode');

    const depBId = bnodeId(depUnionQuad);

    assert.ok(hasIriQuad(depQuads, depBId, 'rdf:type', 'owl:Class'));

    const ifQuads = findQuadsForSubject(depQuads, depBId, 'jt:if');

    assert.ok(ifQuads.length > 0, 'should have jt:if');
  });

  void it('contains, prefixItems, and patternProperties emit array/pattern quads', () => {
    // someValuesFrom restriction
    const containsQuads = tboxQuads({
      '$id': 'https://example.com/ArrayContains',
      'contains': { 'type': 'number' },
      'type': 'array'
    });

    const svfQuad = hasBnodeQuad(containsQuads, 'https://example.com/ArrayContains', 'owl:someValuesFrom');

    assert.ok(svfQuad, 'should have someValuesFrom bnode');

    const bId = bnodeId(svfQuad);

    assert.ok(hasIriQuad(containsQuads, bId, 'rdf:type', 'owl:Restriction'));
    assert.ok(hasIriQuad(containsQuads, bId, 'owl:onProperty', 'rdfs:member'));
    assert.ok(hasIriQuad(containsQuads, bId, 'owl:someValuesFrom', 'xsd:decimal'));

    // qualified cardinality from minContains/maxContains
    const cardQuads = tboxQuads({
      '$id': 'https://example.com/ArrayCard',
      'contains': { 'type': 'string' },
      'maxContains': 5,
      'minContains': 2,
      'type': 'array'
    });

    assert.ok(hasLiteralQuad(
      cardQuads,
      'https://example.com/ArrayCard',
      'owl:minQualifiedCardinality',
      2,
      'xsd:nonNegativeInteger'
    ));
    assert.ok(hasLiteralQuad(
      cardQuads,
      'https://example.com/ArrayCard',
      'owl:maxQualifiedCardinality',
      5,
      'xsd:nonNegativeInteger'
    ));

    // prefixItems -> rdfs:member
    const tupleQuads = tboxQuads({
      '$id': 'https://example.com/Tuple',
      'prefixItems': [
        { 'type': 'string' },
        { 'type': 'number' },
        { 'type': 'boolean' }
      ],
      'type': 'array'
    });

    const memberQuads = findQuadsForSubject(tupleQuads, 'https://example.com/Tuple', 'rdfs:member');

    assert.equal(memberQuads.length, 3);
    assert.ok(hasIriQuad(tupleQuads, 'https://example.com/Tuple', 'rdfs:member', 'xsd:string'));
    assert.ok(hasIriQuad(tupleQuads, 'https://example.com/Tuple', 'rdfs:member', 'xsd:decimal'));
    assert.ok(hasIriQuad(tupleQuads, 'https://example.com/Tuple', 'rdfs:member', 'xsd:boolean'));

    // patternProperties -> sh:pattern
    const patternQuads = tboxQuads({
      '$id': 'https://example.com/PatternProps',
      'patternProperties': {
        '^x-': { 'type': 'string' },
        '^y-': { 'type': 'number' }
      },
      'type': 'object'
    });

    const shPatternQuads = findQuadsForSubject(patternQuads, 'https://example.com/PatternProps', 'sh:pattern');

    assert.ok(shPatternQuads.length >= 2, `expected at least 2 sh:pattern quads, got ${shPatternQuads.length}`);
    assert.ok(hasLiteralQuad(patternQuads, 'https://example.com/PatternProps', 'sh:pattern', '^x-', 'xsd:string'));
    assert.ok(hasLiteralQuad(patternQuads, 'https://example.com/PatternProps', 'sh:pattern', '^y-', 'xsd:string'));
  });

  void it('additionalProperties controls sh:closed', () => {
    const scenarios = [
      {
        'expectedCount': 1,
        'expectedLiteral': {
          'datatype': 'xsd:boolean',
          'value': 'true'
        },
        'schema': {
          '$id': 'https://example.com/Strict',
          'additionalProperties': false,
          'properties': { 'a': { 'type': 'string' } },
          'type': 'object'
        },
        'subject': 'https://example.com/Strict'
      },
      {
        'expectedCount': 0,
        'expectedLiteral': null,
        'schema': {
          '$id': 'https://example.com/Open',
          'additionalProperties': true,
          'type': 'object'
        },
        'subject': 'https://example.com/Open'
      }
    ] as const;

    for (const scenario of scenarios) {
      const quads = tboxQuads(scenario.schema as Record<string, unknown>);
      const closedQuads = findQuadsForSubject(quads, scenario.subject, 'sh:closed');

      assert.equal(closedQuads.length, scenario.expectedCount, `sh:closed count for ${scenario.subject}`);

      if (scenario.expectedLiteral) {
        assert.ok(hasLiteralQuad(
          quads,
          scenario.subject,
          'sh:closed',
          scenario.expectedLiteral.value,
          scenario.expectedLiteral.datatype
        ));
      }
    }
  });

  void it('annotation predicates: readOnly, writeOnly, deprecated', () => {
    const scenarios = [
      {
        'datatype': 'xsd:boolean',
        'predicate': 'dash:readOnly',
        'schema': {
          '$id': 'https://example.com/RO',
          'properties': {
            'id': {
              'readOnly': true,
              'type': 'string'
            }
          },
          'type': 'object'
        },
        'subject': 'https://example.com/RO#/properties/id',
        'value': true
      },
      {
        'datatype': 'xsd:boolean',
        'predicate': 'dash:writeOnly',
        'schema': {
          '$id': 'https://example.com/WO',
          'properties': {
            'password': {
              'type': 'string',
              'writeOnly': true
            }
          },
          'type': 'object'
        },
        'subject': 'https://example.com/WO#/properties/password',
        'value': true
      },
      {
        'datatype': 'xsd:boolean',
        'predicate': 'owl:deprecated',
        'schema': {
          '$id': 'https://example.com/Old',
          'deprecated': true,
          'type': 'string'
        },
        'subject': 'https://example.com/Old',
        'value': 'true'
      }
    ] as const;

    for (const scenario of scenarios) {
      const quads = tboxQuads(scenario.schema as Record<string, unknown>);

      assert.ok(
        hasLiteralQuad(quads, scenario.subject, scenario.predicate, scenario.value, scenario.datatype),
        `expected ${scenario.predicate} = ${String(scenario.value)} on ${scenario.subject}`
      );
    }
  });

  void it('$ref, multi-type, and XSD datatype resolution', () => {
    // $ref produces rdfs:range IRI
    const refQuads = tboxQuads({
      '$id': 'https://example.com/T',
      'properties': { 'friend': { '$ref': 'https://example.com/Person' } },
      'type': 'object'
    });

    assert.ok(hasIriQuad(
      refQuads,
      'https://example.com/T#/properties/friend',
      'rdfs:range',
      'https://example.com/Person'
    ));

    // multi-type produces owl:unionOf with RDF list
    const unionQuads = tboxQuads({
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
    });

    const unionOfQuads = findQuadsForSubject(
      unionQuads,
      'https://example.com/T#/properties/value',
      'owl:unionOf'
    );

    assert.ok(unionOfQuads.length > 0, 'should have unionOf quad');

    const listQuad = unionOfQuads.find((quad) => {
      return quad.object.termType === 'List';
    });

    assert.ok(listQuad, 'should have list-type object');

    if (listQuad.object.termType === 'List') {
      const items = listQuad.object.items;

      assert.equal(items.length, 2);
      assert.equal(items[0].termType, 'NamedNode');
      assert.equal(items[1].termType, 'NamedNode');
      assert.equal(items[0].value, 'xsd:string');
      assert.equal(items[1].value, 'xsd:decimal');
    }

    // XSD datatype resolution: sh:datatype for primitives
    const positiveScenarios = [
      {
        'expectedIri': 'xsd:string',
        'schema': {
          '$id': 'https://example.com/T',
          'properties': { 'name': { 'type': 'string' } },
          'type': 'object'
        },
        'subject': 'https://example.com/T#/properties/name'
      },
      {
        'expectedIri': 'xsd:dateTime',
        'schema': {
          '$id': 'https://example.com/T',
          'properties': {
            'created': {
              'format': 'date-time',
              'type': 'string'
            }
          },
          'type': 'object'
        },
        'subject': 'https://example.com/T#/properties/created'
      }
    ] as const;

    for (const scenario of positiveScenarios) {
      const quads = tboxQuads(scenario.schema as Record<string, unknown>);

      assert.ok(
        hasIriQuad(quads, scenario.subject, 'sh:datatype', scenario.expectedIri),
        `expected sh:datatype = ${scenario.expectedIri} on ${scenario.subject}`
      );
    }

    // Negative: object type should not emit sh:datatype
    const objectQuads = tboxQuads({
      '$id': 'https://example.com/T',
      'properties': { 'meta': { 'type': 'object' } },
      'type': 'object'
    });

    const dtQuads = findQuadsForSubject(
      objectQuads,
      'https://example.com/T#/properties/meta',
      'sh:datatype'
    );

    assert.equal(dtQuads.length, 0);
  });
});

void describe('quadsToJsonLdNodes', () => {
  void it('preserves stable blank node identifiers without double-prefixing', () => {
    const quads: QuadInterface[] = [
      {
        'object': {
          'termType': 'BlankNode' as const,
          'value': '_:b1'
        },
        'predicate': 'ex:child',
        'subject': 'https://example.com/Thing'
      },
      {
        'object': {
          'termType': 'NamedNode' as const,
          'value': 'ex:Nested'
        },
        'predicate': 'rdf:type',
        'subject': '_:b1'
      },
      {
        'object': {
          'datatype': {
            'termType': 'NamedNode' as const,
            'value': 'xsd:string'
          },
          'language': '',
          'termType': 'Literal' as const,
          'value': 'nested'
        },
        'predicate': 'ex:value',
        'subject': '_:b1'
      }
    ];

    const nodes = quadsToJsonLdNodes(quads);
    const root = nodes.find((node) => {
      return node['@id'] === 'https://example.com/Thing';
    });
    const nested = nodes.find((node) => {
      return node['@id'] === '_:b1';
    });

    assert.ok(root);
    assert.ok(nested);
    assert.deepEqual(root['ex:child'], { '@id': '_:b1' });
    assert.equal(JSON.stringify(nodes).includes('_:_:b1'), false);
  });
});

// ---------------------------------------------------------------------------
// ABox tests
// ---------------------------------------------------------------------------

void describe('projectAbox — ABox projection', () => {
  void it('simple instance produces typed quads, arrays expand, nulls are omitted', () => {
    // simple instance produces rdf:type and property literals
    const schema: Record<string, unknown> = {
      '$id': 'https://example.com/User',
      'properties': {
        'active': { 'type': 'boolean' },
        'age': { 'type': 'integer' },
        'name': { 'type': 'string' }
      },
      'type': 'object'
    };

    const graph = new SchemaGraph(schema);
    const data = {
      'active': true,
      'age': 30,
      'name': 'Alice'
    };
    const quads = projectAbox(graph, data, 'https://data.example.com');

    const typeQuads = findQuads(quads, 'rdf:type');

    assert.ok(typeQuads.length > 0, 'should have at least one rdf:type quad');

    const instIRI = typeQuads[0].subject;

    assert.ok(instIRI.startsWith('https://data.example.com/'));
    assert.ok(hasIriQuad(quads, instIRI, 'rdf:type', 'https://example.com/User'));
    assert.ok(hasLiteralQuad(quads, instIRI, 'https://example.com/User#name', 'Alice', 'xsd:string'));
    assert.ok(hasLiteralQuad(quads, instIRI, 'https://example.com/User#age', 30, 'xsd:integer'));
    assert.ok(hasLiteralQuad(quads, instIRI, 'https://example.com/User#active', true, 'xsd:boolean'));

    // array values produce one quad per element
    const arrSchema: Record<string, unknown> = {
      '$id': 'https://example.com/Tags',
      'properties': {
        'tags': {
          'items': { 'type': 'string' },
          'type': 'array'
        }
      },
      'type': 'object'
    };

    const arrGraph = new SchemaGraph(arrSchema);
    const arrData = {
      'tags': [
        'red',
        'green',
        'blue'
      ]
    };
    const arrQuads = projectAbox(arrGraph, arrData, 'https://data.example.com');

    const arrTypeQuad = arrQuads.find((quad) => {
      return quad.predicate === 'rdf:type';
    });

    assert.ok(arrTypeQuad, 'should have rdf:type quad');
    const arrInstIRI = arrTypeQuad.subject;
    const tagQuads = findQuadsForSubject(arrQuads, arrInstIRI, 'https://example.com/Tags#tags');

    assert.equal(tagQuads.length, 3);

    const tagValues = new Set(tagQuads
      .filter((quad) => {
        return quad.object.termType === 'Literal';
      })
      .map((quad) => {
        return quad.object.termType === 'Literal' ? quad.object.value : null;
      }));

    assert.ok(tagValues.has('red'));
    assert.ok(tagValues.has('green'));
    assert.ok(tagValues.has('blue'));

    // null values are omitted from quads
    const nullSchema: Record<string, unknown> = {
      '$id': 'https://example.com/Nullable',
      'properties': {
        'name': { 'type': 'string' },
        'nickname': { 'type': 'string' }
      },
      'type': 'object'
    };

    const nullGraph = new SchemaGraph(nullSchema);
    const nullData = {
      'name': 'Alice',
      'nickname': null
    };
    const nullQuads = projectAbox(nullGraph, nullData, 'https://data.example.com');

    const nullTypeQuad = nullQuads.find((quad) => {
      return quad.predicate === 'rdf:type';
    });

    assert.ok(nullTypeQuad, 'should have rdf:type quad');
    const nullInstIRI = nullTypeQuad.subject;

    assert.ok(hasLiteralQuad(nullQuads, nullInstIRI, 'https://example.com/Nullable#name', 'Alice'));

    const nickQuads = findQuadsForSubject(nullQuads, nullInstIRI, 'https://example.com/Nullable#nickname');

    assert.equal(nickQuads.length, 0);
  });

  void it('nested object produces linked instance quads', () => {
    const schema: Record<string, unknown> = {
      '$id': 'https://example.com/Parent',
      'properties': {
        'address': {
          'properties': {
            'city': { 'type': 'string' },
            'street': { 'type': 'string' }
          },
          'type': 'object'
        },
        'name': { 'type': 'string' }
      },
      'type': 'object'
    };

    const graph = new SchemaGraph(schema);
    const data = {
      'address': {
        'city': 'Springfield',
        'street': '123 Main St'
      },
      'name': 'Bob'
    };
    const quads = projectAbox(graph, data, 'https://data.example.com');

    const parentTypeQuads = quads.filter((quad) => {
      return quad.predicate === 'rdf:type'
      && quad.object.termType === 'NamedNode'
      && quad.object.value === 'https://example.com/Parent';
    });

    assert.equal(parentTypeQuads.length, 1);
    const parentIRI = parentTypeQuads[0].subject;

    const addrQuads = findQuadsForSubject(quads, parentIRI, 'https://example.com/Parent#address');

    assert.equal(addrQuads.length, 1);
    assert.equal(addrQuads[0].object.termType, 'NamedNode');

    const nestedIRI = addrQuads[0].object.value;

    assert.ok(
      hasLiteralQuad(quads, nestedIRI, 'https://example.com/Parent#/properties/address#street', 'Springfield', 'xsd:string')
      || hasLiteralQuad(quads, nestedIRI, 'https://example.com/Parent#/properties/address#city', 'Springfield', 'xsd:string')
      || quads.some((quad) => {
        return quad.subject === nestedIRI
        && quad.predicate.includes('city')
        && quad.object.termType === 'Literal'
        && quad.object.value === 'Springfield';
      }),
      'nested instance should have city property'
    );
  });

  void it('TBox + ABox coherence: instance types match declared classes', () => {
    const schema: Record<string, unknown> = {
      '$id': 'https://example.com/Item',
      'properties': {
        'count': { 'type': 'integer' },
        'label': { 'type': 'string' }
      },
      'required': ['label'],
      'type': 'object'
    };

    const graph = new SchemaGraph(schema);
    const tbox = projectGraph(graph);
    const abox = projectAbox(graph, {
      'count': 5,
      'label': 'Widget'
    }, 'https://data.example.com');

    const tboxClasses = new Set(tbox
      .filter((quad) => {
        return quad.predicate === 'rdf:type' && quad.object.termType === 'NamedNode' && quad.object.value === 'owl:Class';
      })
      .map((quad) => {
        return quad.subject;
      }));

    const aboxTypes = abox
      .filter((quad) => {
        return quad.predicate === 'rdf:type' && quad.object.termType === 'NamedNode';
      })
      .map((quad) => {
        return quad.object.termType === 'NamedNode' ? quad.object.value : '';
      });

    for (const aboxType of aboxTypes) {
      assert.ok(
        tboxClasses.has(aboxType),
        `ABox type ${aboxType} should be declared as owl:Class in TBox`
      );
    }

    const aboxPropPredicates = abox
      .filter((quad) => {
        return quad.predicate !== 'rdf:type';
      })
      .map((quad) => {
        return quad.predicate;
      });

    for (const pred of aboxPropPredicates) {
      assert.ok(
        pred.startsWith('https://example.com/Item'),
        `ABox property predicate ${pred} should reference the schema class`
      );
    }
  });
});
