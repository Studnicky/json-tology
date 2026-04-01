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
  void describe('class, property, domain, and required-restriction quads', () => {
    const scenarios: Array<{ 'check': (quads: QuadInterface[]) => void;
      'name': string;
      'schema': Record<string, unknown>; }> = [
      {
        'check': (quads) => {
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
        },
        'name': 'emits owl:Class for object schema',
        'schema': {
          '$id': 'https://example.com/Person',
          'properties': {
            'age': { 'type': 'integer' },
            'name': { 'type': 'string' }
          },
          'type': 'object'
        }
      },
      {
        'check': (quads) => {
          const restrictionLink = hasBnodeQuad(quads, 'https://example.com/Person', 'rdfs:subClassOf');

          assert.ok(restrictionLink, 'should have restriction bnode');

          const bId = bnodeId(restrictionLink);

          assert.ok(hasIriQuad(quads, bId, 'rdf:type', 'owl:Restriction'));
          assert.ok(hasIriQuad(quads, bId, 'owl:onProperty', 'https://example.com/Person#name'));
          assert.ok(hasLiteralQuad(quads, bId, 'owl:minCardinality', 1, 'xsd:nonNegativeInteger'));
          assert.ok(hasLiteralQuad(
            quads,
            'https://example.com/Person#/properties/name',
            'sh:minCount',
            1,
            'xsd:integer'
          ));
        },
        'name': 'required property produces owl:Restriction with minCardinality',
        'schema': {
          '$id': 'https://example.com/Person',
          'properties': { 'name': { 'type': 'string' } },
          'required': ['name'],
          'type': 'object'
        }
      },
      // Edge cases
      {
        'check': (quads) => {
          assert.ok(
            hasIriQuad(quads, 'https://example.com/Bare', 'rdf:type', 'owl:Class'),
            'bare schema with $id should still emit owl:Class'
          );

          const propQuads = quads.filter((quad) => {
            return quad.predicate === 'rdf:type'
              && quad.object.termType === 'NamedNode'
              && (quad.object.value === 'owl:DatatypeProperty' || quad.object.value === 'owl:ObjectProperty');
          });

          assert.equal(propQuads.length, 0, 'bare schema should not emit property type quads');
        },
        'name': 'schema with $id but no type still emits owl:Class',
        'schema': { '$id': 'https://example.com/Bare' }
      },
      {
        'check': (quads) => {
          assert.ok(hasIriQuad(quads, 'https://example.com/NoProps', 'rdf:type', 'owl:Class'));

          const propQuads = quads.filter((quad) => {
            return quad.predicate === 'rdf:type'
              && quad.object.termType === 'NamedNode'
              && (quad.object.value === 'owl:DatatypeProperty' || quad.object.value === 'owl:ObjectProperty');
          });

          assert.equal(propQuads.length, 0, 'no-properties schema should not emit property type quads');
        },
        'name': 'schema with no properties emits class but no property quads',
        'schema': {
          '$id': 'https://example.com/NoProps',
          'type': 'object'
        }
      }
    ];

    for (const {
      check, name, schema
    } of scenarios) {
      void it(name, () => {
        const quads = tboxQuads(schema);

        check(quads);
      });
    }
  });

  void describe('string and numeric constraint quads', () => {
    const scenarios: Array<{
      'check': (quads: QuadInterface[]) => void;
      'name': string;
      'schema': Record<string, unknown>;
    }> = [
      {
        'check': (quads) => {
          assert.ok(
            hasLiteralQuad(quads, 'https://example.com/T#/properties/code', 'sh:minLength', 2, 'xsd:integer'),
            'expected sh:minLength = 2'
          );
          assert.ok(
            hasLiteralQuad(quads, 'https://example.com/T#/properties/code', 'sh:maxLength', 10, 'xsd:integer'),
            'expected sh:maxLength = 10'
          );
          assert.ok(
            hasLiteralQuad(quads, 'https://example.com/T#/properties/code', 'sh:pattern', '^[A-Z]+$', 'xsd:string'),
            'expected sh:pattern = ^[A-Z]+$'
          );
        },
        'name': 'string constraints: minLength, maxLength, pattern',
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
        'check': (quads) => {
          assert.ok(
            hasLiteralQuad(quads, 'https://example.com/T#/properties/score', 'sh:minInclusive', 0, 'xsd:decimal'),
            'expected sh:minInclusive = 0'
          );
          assert.ok(
            hasLiteralQuad(quads, 'https://example.com/T#/properties/score', 'sh:maxInclusive', 100, 'xsd:decimal'),
            'expected sh:maxInclusive = 100'
          );
          assert.ok(
            hasLiteralQuad(quads, 'https://example.com/T#/properties/delta', 'sh:minExclusive', -1, 'xsd:decimal'),
            'expected sh:minExclusive = -1'
          );
          assert.ok(
            hasLiteralQuad(quads, 'https://example.com/T#/properties/delta', 'sh:maxExclusive', 200, 'xsd:decimal'),
            'expected sh:maxExclusive = 200'
          );
        },
        'name': 'numeric constraints: min/maxInclusive, min/maxExclusive',
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
    ];

    for (const {
      check, name, schema
    } of scenarios) {
      void it(name, () => {
        const quads = tboxQuads(schema);

        check(quads);
      });
    }
  });

  void describe('enum and const quads', () => {
    const scenarios: Array<{
      'check': (quads: QuadInterface[]) => void;
      'name': string;
      'schema': Record<string, unknown>;
    }> = [
      {
        'check': (quads) => {
          const oneOfQuads = findQuadsForSubject(quads, 'https://example.com/Status', 'owl:oneOf');

          assert.equal(oneOfQuads.length, 3);
          assert.ok(hasLiteralQuad(quads, 'https://example.com/Status', 'owl:oneOf', 'active', 'xsd:string'));
          assert.ok(hasLiteralQuad(quads, 'https://example.com/Status', 'owl:oneOf', 'inactive', 'xsd:string'));
          assert.ok(hasLiteralQuad(quads, 'https://example.com/Status', 'owl:oneOf', 'pending', 'xsd:string'));
        },
        'name': 'enum produces owl:oneOf',
        'schema': {
          '$id': 'https://example.com/Status',
          'enum': [
            'active',
            'inactive',
            'pending'
          ],
          'type': 'string'
        }
      },
      {
        'check': (quads) => {
          assert.ok(hasLiteralQuad(quads, 'https://example.com/Const', 'owl:hasValue', 'fixed', 'xsd:string'));
        },
        'name': 'const produces owl:hasValue',
        'schema': {
          '$id': 'https://example.com/Const',
          'const': 'fixed',
          'type': 'string'
        }
      }
    ];

    for (const {
      check, name, schema
    } of scenarios) {
      void it(name, () => {
        const quads = tboxQuads(schema);

        check(quads);
      });
    }
  });

  void describe('composition keywords', () => {
    const scenarios: Array<{
      'check': (quads: QuadInterface[]) => void;
      'name': string;
      'schema': Record<string, unknown>;
    }> = [
      {
        'check': (quads) => {
          assert.ok(hasIriQuad(quads, 'https://example.com/Child', 'rdfs:subClassOf', 'https://example.com/Parent'));
        },
        'name': 'allOf produces rdfs:subClassOf',
        'schema': {
          '$id': 'https://example.com/Child',
          'allOf': [{ '$ref': 'https://example.com/Parent' }],
          'type': 'object'
        }
      },
      {
        'check': (quads) => {
          const eqQuads = findQuadsForSubject(quads, 'https://example.com/Union', 'owl:equivalentClass');

          assert.ok(eqQuads.length >= 2, 'expected >= 2 owl:equivalentClass quads for anyOf');
        },
        'name': 'anyOf produces owl:equivalentClass',
        'schema': {
          '$id': 'https://example.com/Union',
          'anyOf': [
            { 'type': 'string' },
            { 'type': 'number' }
          ]
        }
      },
      {
        'check': (quads) => {
          const eqQuads = findQuadsForSubject(quads, 'https://example.com/Exclusive', 'owl:equivalentClass');

          assert.ok(eqQuads.length >= 2, 'expected >= 2 owl:equivalentClass quads for oneOf');
        },
        'name': 'oneOf produces owl:equivalentClass',
        'schema': {
          '$id': 'https://example.com/Exclusive',
          'oneOf': [
            { 'type': 'string' },
            { 'type': 'boolean' }
          ]
        }
      },
      {
        'check': (quads) => {
          const compQuads = findQuadsForSubject(quads, 'https://example.com/NotArray', 'owl:complementOf');

          assert.ok(compQuads.length > 0);
        },
        'name': 'not produces owl:complementOf',
        'schema': {
          '$id': 'https://example.com/NotArray',
          'not': { 'type': 'array' }
        }
      }
    ];

    for (const {
      check, name, schema
    } of scenarios) {
      void it(name, () => {
        const quads = tboxQuads(schema);

        check(quads);
      });
    }
  });

  void describe('conditionals and dependentSchemas', () => {
    const scenarios: Array<{
      'check': (quads: QuadInterface[]) => void;
      'name': string;
      'schema': Record<string, unknown>;
    }> = [
      {
        'check': (quads) => {
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
        },
        'name': 'if/then/else produces owl:unionOf bnode with jt: predicates',
        'schema': {
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
        }
      },
      {
        'check': (quads) => {
          const depUnionQuad = hasBnodeQuad(quads, 'https://example.com/Deps', 'owl:unionOf');

          assert.ok(depUnionQuad, 'should have conditional bnode');

          const depBId = bnodeId(depUnionQuad);

          assert.ok(hasIriQuad(quads, depBId, 'rdf:type', 'owl:Class'));

          const ifQuads = findQuadsForSubject(quads, depBId, 'jt:if');

          assert.ok(ifQuads.length > 0, 'should have jt:if');
        },
        'name': 'dependentSchemas produces conditional bnode with jt:if',
        'schema': {
          '$id': 'https://example.com/Deps',
          'dependentSchemas': {
            'address': {
              'properties': { 'zip': { 'type': 'string' } },
              'type': 'object'
            }
          },
          'properties': { 'address': { 'type': 'string' } },
          'type': 'object'
        }
      }
    ];

    for (const {
      check, name, schema
    } of scenarios) {
      void it(name, () => {
        const quads = tboxQuads(schema);

        check(quads);
      });
    }
  });

  void describe('contains, prefixItems, and patternProperties', () => {
    const scenarios: Array<{
      'check': (quads: QuadInterface[]) => void;
      'name': string;
      'schema': Record<string, unknown>;
    }> = [
      {
        'check': (quads) => {
          const svfQuad = hasBnodeQuad(quads, 'https://example.com/ArrayContains', 'owl:someValuesFrom');

          assert.ok(svfQuad, 'should have someValuesFrom bnode');

          const bId = bnodeId(svfQuad);

          assert.ok(hasIriQuad(quads, bId, 'rdf:type', 'owl:Restriction'));
          assert.ok(hasIriQuad(quads, bId, 'owl:onProperty', 'rdfs:member'));
          assert.ok(hasIriQuad(quads, bId, 'owl:someValuesFrom', 'xsd:decimal'));
        },
        'name': 'contains emits someValuesFrom restriction',
        'schema': {
          '$id': 'https://example.com/ArrayContains',
          'contains': { 'type': 'number' },
          'type': 'array'
        }
      },
      {
        'check': (quads) => {
          assert.ok(hasLiteralQuad(
            quads,
            'https://example.com/ArrayCard',
            'owl:minQualifiedCardinality',
            2,
            'xsd:nonNegativeInteger'
          ));
          assert.ok(hasLiteralQuad(
            quads,
            'https://example.com/ArrayCard',
            'owl:maxQualifiedCardinality',
            5,
            'xsd:nonNegativeInteger'
          ));
        },
        'name': 'minContains/maxContains emit qualified cardinality',
        'schema': {
          '$id': 'https://example.com/ArrayCard',
          'contains': { 'type': 'string' },
          'maxContains': 5,
          'minContains': 2,
          'type': 'array'
        }
      },
      {
        'check': (quads) => {
          const memberQuads = findQuadsForSubject(quads, 'https://example.com/Tuple', 'rdfs:member');

          assert.equal(memberQuads.length, 3);
          assert.ok(hasIriQuad(quads, 'https://example.com/Tuple', 'rdfs:member', 'xsd:string'));
          assert.ok(hasIriQuad(quads, 'https://example.com/Tuple', 'rdfs:member', 'xsd:decimal'));
          assert.ok(hasIriQuad(quads, 'https://example.com/Tuple', 'rdfs:member', 'xsd:boolean'));
        },
        'name': 'prefixItems produce rdfs:member quads',
        'schema': {
          '$id': 'https://example.com/Tuple',
          'prefixItems': [
            { 'type': 'string' },
            { 'type': 'number' },
            { 'type': 'boolean' }
          ],
          'type': 'array'
        }
      },
      {
        'check': (quads) => {
          const shPatternQuads = findQuadsForSubject(quads, 'https://example.com/PatternProps', 'sh:pattern');

          assert.ok(shPatternQuads.length >= 2, `expected at least 2 sh:pattern quads, got ${shPatternQuads.length}`);
          assert.ok(hasLiteralQuad(quads, 'https://example.com/PatternProps', 'sh:pattern', '^x-', 'xsd:string'));
          assert.ok(hasLiteralQuad(quads, 'https://example.com/PatternProps', 'sh:pattern', '^y-', 'xsd:string'));
        },
        'name': 'patternProperties emit sh:pattern quads',
        'schema': {
          '$id': 'https://example.com/PatternProps',
          'patternProperties': {
            '^x-': { 'type': 'string' },
            '^y-': { 'type': 'number' }
          },
          'type': 'object'
        }
      }
    ];

    for (const {
      check, name, schema
    } of scenarios) {
      void it(name, () => {
        const quads = tboxQuads(schema);

        check(quads);
      });
    }
  });

  void describe('additionalProperties controls sh:closed', () => {
    const scenarios: Array<{
      'check': (quads: QuadInterface[]) => void;
      'name': string;
      'schema': Record<string, unknown>;
    }> = [
      {
        'check': (quads) => {
          const closedQuads = findQuadsForSubject(quads, 'https://example.com/Strict', 'sh:closed');

          assert.equal(closedQuads.length, 1, 'sh:closed count for strict');
          assert.ok(hasLiteralQuad(
            quads,
            'https://example.com/Strict',
            'sh:closed',
            'true',
            'xsd:boolean'
          ));
        },
        'name': 'additionalProperties: false emits sh:closed true',
        'schema': {
          '$id': 'https://example.com/Strict',
          'additionalProperties': false,
          'properties': { 'a': { 'type': 'string' } },
          'type': 'object'
        }
      },
      {
        'check': (quads) => {
          const closedQuads = findQuadsForSubject(quads, 'https://example.com/Open', 'sh:closed');

          assert.equal(closedQuads.length, 0, 'sh:closed count for open');
        },
        'name': 'additionalProperties: true does not emit sh:closed',
        'schema': {
          '$id': 'https://example.com/Open',
          'additionalProperties': true,
          'type': 'object'
        }
      }
    ];

    for (const {
      check, name, schema
    } of scenarios) {
      void it(name, () => {
        const quads = tboxQuads(schema);

        check(quads);
      });
    }
  });

  void describe('annotation predicates', () => {
    const scenarios: Array<{
      'check': (quads: QuadInterface[]) => void;
      'name': string;
      'schema': Record<string, unknown>;
    }> = [
      {
        'check': (quads) => {
          assert.ok(
            hasLiteralQuad(quads, 'https://example.com/RO#/properties/id', 'dash:readOnly', true, 'xsd:boolean'),
            'expected dash:readOnly = true'
          );
        },
        'name': 'readOnly emits dash:readOnly',
        'schema': {
          '$id': 'https://example.com/RO',
          'properties': {
            'id': {
              'readOnly': true,
              'type': 'string'
            }
          },
          'type': 'object'
        }
      },
      {
        'check': (quads) => {
          assert.ok(
            hasLiteralQuad(quads, 'https://example.com/WO#/properties/password', 'dash:writeOnly', true, 'xsd:boolean'),
            'expected dash:writeOnly = true'
          );
        },
        'name': 'writeOnly emits dash:writeOnly',
        'schema': {
          '$id': 'https://example.com/WO',
          'properties': {
            'password': {
              'type': 'string',
              'writeOnly': true
            }
          },
          'type': 'object'
        }
      },
      {
        'check': (quads) => {
          assert.ok(
            hasLiteralQuad(quads, 'https://example.com/Old', 'owl:deprecated', 'true', 'xsd:boolean'),
            'expected owl:deprecated = true'
          );
        },
        'name': 'deprecated emits owl:deprecated',
        'schema': {
          '$id': 'https://example.com/Old',
          'deprecated': true,
          'type': 'string'
        }
      }
    ];

    for (const {
      check, name, schema
    } of scenarios) {
      void it(name, () => {
        const quads = tboxQuads(schema);

        check(quads);
      });
    }
  });

  void describe('$ref, multi-type, and XSD datatype resolution', () => {
    const scenarios: Array<{
      'check': (quads: QuadInterface[]) => void;
      'name': string;
      'schema': Record<string, unknown>;
    }> = [
      {
        'check': (quads) => {
          assert.ok(hasIriQuad(
            quads,
            'https://example.com/T#/properties/friend',
            'rdfs:range',
            'https://example.com/Person'
          ));
        },
        'name': '$ref produces rdfs:range IRI',
        'schema': {
          '$id': 'https://example.com/T',
          'properties': { 'friend': { '$ref': 'https://example.com/Person' } },
          'type': 'object'
        }
      },
      {
        'check': (quads) => {
          const unionOfQuads = findQuadsForSubject(
            quads,
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
        },
        'name': 'multi-type produces owl:unionOf with RDF list',
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
        'check': (quads) => {
          assert.ok(
            hasIriQuad(quads, 'https://example.com/T#/properties/name', 'sh:datatype', 'xsd:string'),
            'expected sh:datatype = xsd:string'
          );
        },
        'name': 'sh:datatype for string property',
        'schema': {
          '$id': 'https://example.com/T',
          'properties': { 'name': { 'type': 'string' } },
          'type': 'object'
        }
      },
      {
        'check': (quads) => {
          assert.ok(
            hasIriQuad(quads, 'https://example.com/T#/properties/created', 'sh:datatype', 'xsd:dateTime'),
            'expected sh:datatype = xsd:dateTime'
          );
        },
        'name': 'sh:datatype for date-time format resolves to xsd:dateTime',
        'schema': {
          '$id': 'https://example.com/T',
          'properties': {
            'created': {
              'format': 'date-time',
              'type': 'string'
            }
          },
          'type': 'object'
        }
      },
      {
        'check': (quads) => {
          const dtQuads = findQuadsForSubject(
            quads,
            'https://example.com/T#/properties/meta',
            'sh:datatype'
          );

          assert.equal(dtQuads.length, 0);
        },
        'name': 'object type does not emit sh:datatype',
        'schema': {
          '$id': 'https://example.com/T',
          'properties': { 'meta': { 'type': 'object' } },
          'type': 'object'
        }
      }
    ];

    for (const {
      check, name, schema
    } of scenarios) {
      void it(name, () => {
        const quads = tboxQuads(schema);

        check(quads);
      });
    }
  });
});

// ---------------------------------------------------------------------------
// quadsToJsonLdNodes
// ---------------------------------------------------------------------------

void describe('quadsToJsonLdNodes', () => {
  const scenarios: Array<{
    'check': (nodes: Array<Record<string, unknown>>) => void;
    'name': string;
    'quads': QuadInterface[];
  }> = [{
    'check': (nodes) => {
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
    },
    'name': 'preserves stable blank node identifiers without double-prefixing',
    'quads': [
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
    ]
  }];

  for (const {
    check, name, quads
  } of scenarios) {
    void it(name, () => {
      const nodes = quadsToJsonLdNodes(quads);

      check(nodes);
    });
  }
});

// ---------------------------------------------------------------------------
// ABox tests
// ---------------------------------------------------------------------------

void describe('projectAbox — ABox projection', () => {
  void describe('simple instance projection', () => {
    const scenarios: Array<{
      'check': (quads: QuadInterface[]) => void;
      'instance': Record<string, unknown>;
      'name': string;
      'schema': Record<string, unknown>;
    }> = [
      {
        'check': (quads) => {
          const typeQuads = findQuads(quads, 'rdf:type');

          assert.ok(typeQuads.length > 0, 'should have at least one rdf:type quad');

          const instIRI = typeQuads[0].subject;

          assert.ok(instIRI.startsWith('https://data.example.com/'));
          assert.ok(hasIriQuad(quads, instIRI, 'rdf:type', 'https://example.com/User'));
          assert.ok(hasLiteralQuad(quads, instIRI, 'https://example.com/User#name', 'Alice', 'xsd:string'));
          assert.ok(hasLiteralQuad(quads, instIRI, 'https://example.com/User#age', 30, 'xsd:integer'));
          assert.ok(hasLiteralQuad(quads, instIRI, 'https://example.com/User#active', true, 'xsd:boolean'));
        },
        'instance': {
          'active': true,
          'age': 30,
          'name': 'Alice'
        },
        'name': 'simple instance produces typed quads with rdf:type and property literals',
        'schema': {
          '$id': 'https://example.com/User',
          'properties': {
            'active': { 'type': 'boolean' },
            'age': { 'type': 'integer' },
            'name': { 'type': 'string' }
          },
          'type': 'object'
        }
      },
      {
        'check': (quads) => {
          const arrTypeQuad = quads.find((quad) => {
            return quad.predicate === 'rdf:type';
          });

          assert.ok(arrTypeQuad, 'should have rdf:type quad');
          const arrInstIRI = arrTypeQuad.subject;
          const tagQuads = findQuadsForSubject(quads, arrInstIRI, 'https://example.com/Tags#tags');

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
        },
        'instance': {
          'tags': [
            'red',
            'green',
            'blue'
          ]
        },
        'name': 'array values produce one quad per element',
        'schema': {
          '$id': 'https://example.com/Tags',
          'properties': {
            'tags': {
              'items': { 'type': 'string' },
              'type': 'array'
            }
          },
          'type': 'object'
        }
      },
      {
        'check': (quads) => {
          const nullTypeQuad = quads.find((quad) => {
            return quad.predicate === 'rdf:type';
          });

          assert.ok(nullTypeQuad, 'should have rdf:type quad');
          const nullInstIRI = nullTypeQuad.subject;

          assert.ok(hasLiteralQuad(quads, nullInstIRI, 'https://example.com/Nullable#name', 'Alice'));

          const nickQuads = findQuadsForSubject(quads, nullInstIRI, 'https://example.com/Nullable#nickname');

          assert.equal(nickQuads.length, 0);
        },
        'instance': {
          'name': 'Alice',
          'nickname': null
        },
        'name': 'null values are omitted from quads',
        'schema': {
          '$id': 'https://example.com/Nullable',
          'properties': {
            'name': { 'type': 'string' },
            'nickname': { 'type': 'string' }
          },
          'type': 'object'
        }
      },
      // Edge cases
      {
        'check': (quads) => {
          const nonTypeQuads = quads.filter((quad) => {
            return quad.predicate !== 'rdf:type';
          });

          assert.equal(nonTypeQuads.length, 0, 'empty instance should produce no property quads');
        },
        'instance': {},
        'name': 'empty schema projection produces no property quads',
        'schema': {
          '$id': 'https://example.com/EmptyProjection',
          'type': 'object'
        }
      },
      {
        'check': (quads) => {
          const typeQuads = findQuads(quads, 'rdf:type');

          assert.ok(typeQuads.length > 0, 'should still produce rdf:type quad');
        },
        'instance': { 'undeclared': 'value' },
        'name': 'schema with no properties produces only type quad for instance with extra keys',
        'schema': {
          '$id': 'https://example.com/NoPropsSchema',
          'type': 'object'
        }
      }
    ];

    for (const {
      check, instance, name, schema
    } of scenarios) {
      void it(name, () => {
        const graph = new SchemaGraph(schema);
        const quads = projectAbox(graph, instance, 'https://data.example.com');

        check(quads);
      });
    }
  });

  void describe('nested object projection', () => {
    const scenarios: Array<{
      'check': (quads: QuadInterface[]) => void;
      'instance': Record<string, unknown>;
      'name': string;
      'schema': Record<string, unknown>;
    }> = [{
      'check': (quads) => {
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
      },
      'instance': {
        'address': {
          'city': 'Springfield',
          'street': '123 Main St'
        },
        'name': 'Bob'
      },
      'name': 'nested object produces linked instance quads',
      'schema': {
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
      }
    }];

    for (const {
      check, instance, name, schema
    } of scenarios) {
      void it(name, () => {
        const graph = new SchemaGraph(schema);
        const quads = projectAbox(graph, instance, 'https://data.example.com');

        check(quads);
      });
    }
  });

  void describe('TBox + ABox coherence', () => {
    const scenarios: Array<{
      'check': (tbox: QuadInterface[], abox: QuadInterface[]) => void;
      'instance': Record<string, unknown>;
      'name': string;
      'schema': Record<string, unknown>;
    }> = [{
      'check': (tbox, abox) => {
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
      },
      'instance': {
        'count': 5,
        'label': 'Widget'
      },
      'name': 'instance types match declared classes',
      'schema': {
        '$id': 'https://example.com/Item',
        'properties': {
          'count': { 'type': 'integer' },
          'label': { 'type': 'string' }
        },
        'required': ['label'],
        'type': 'object'
      }
    }];

    for (const {
      check, instance, name, schema
    } of scenarios) {
      void it(name, () => {
        const graph = new SchemaGraph(schema);
        const tbox = projectGraph(graph);
        const abox = projectAbox(graph, instance, 'https://data.example.com');

        check(tbox, abox);
      });
    }
  });
});
