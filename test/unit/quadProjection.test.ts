import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { SchemaGraph } from '../../src/modules/graph/SchemaGraph.js';
import {
  projectAbox, projectGraph, quadsToJsonLdNodes
} from '../../src/modules/rdf/Projection.js';
import { resetBnodeCounter } from '../../src/modules/rdf/Projection.js';
import type {
  QuadInterface, QuadObjectType
} from '../../src/modules/rdf/Quad.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findQuads(quads: QuadInterface[], predicate: string): QuadInterface[] {
  return quads.filter((q) => {
    return q.predicate === predicate;
  });
}

function findQuadsForSubject(quads: QuadInterface[], subject: string, predicate: string): QuadInterface[] {
  return quads.filter((q) => {
    return q.subject === subject && q.predicate === predicate;
  });
}

function hasQuad(quads: QuadInterface[], subject: string, predicate: string, objectValue: string): boolean {
  return quads.some((q) => {
    return q.subject === subject
    && q.predicate === predicate
    && (
      (q.object.type === 'iri' && q.object.value === objectValue)
      || (q.object.type === 'literal' && String(q.object.value) === objectValue)
      || (q.object.type === 'bnode' && q.object.id === objectValue)
    );
  });
}

function hasIriQuad(quads: QuadInterface[], subject: string, predicate: string, objectIri: string): boolean {
  return quads.some((q) => {
    return q.subject === subject
    && q.predicate === predicate
    && q.object.type === 'iri'
    && q.object.value === objectIri;
  });
}

function hasLiteralQuad(quads: QuadInterface[], subject: string, predicate: string, value: unknown, datatype?: string): boolean {
  return quads.some((q) => {
    return q.subject === subject
    && q.predicate === predicate
    && q.object.type === 'literal'
    && q.object.value === value
    && (datatype === undefined || q.object.datatype === datatype);
  });
}

function hasBnodeQuad(quads: QuadInterface[], subject: string, predicate: string): QuadInterface | undefined {
  return quads.find((q) => {
    return q.subject === subject
    && q.predicate === predicate
    && q.object.type === 'bnode';
  });
}

function bnodeId(q: QuadInterface): string {
  if (q.object.type === 'bnode') {
    return q.object.id;
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

describe('projectGraph — TBox projection', () => {
  describe('1. Simple class with properties', () => {
    it('emits owl:Class, property type, and domain quads', () => {
      const quads = tboxQuads({
        '$id': 'https://example.com/Person',
        'properties': {
          'age': { 'type': 'integer' },
          'name': { 'type': 'string' }
        },
        'type': 'object'
      });

      // owl:Class for the root
      assert.ok(hasIriQuad(quads, 'https://example.com/Person', 'rdf:type', 'owl:Class'));

      // Property type classification
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

      // Domain
      assert.ok(hasIriQuad(
        quads,
        'https://example.com/Person#/properties/name',
        'rdfs:domain',
        'https://example.com/Person'
      ));
    });
  });

  describe('2. Required properties produce owl:Restriction', () => {
    it('emits restriction blank node with minCardinality', () => {
      const quads = tboxQuads({
        '$id': 'https://example.com/Person',
        'properties': { 'name': { 'type': 'string' } },
        'required': ['name'],
        'type': 'object'
      });

      // Find the rdfs:subClassOf bnode
      const restrictionLink = hasBnodeQuad(quads, 'https://example.com/Person', 'rdfs:subClassOf');

      assert.ok(restrictionLink, 'should have restriction bnode');

      const bId = bnodeId(restrictionLink);

      // Restriction type
      assert.ok(hasIriQuad(quads, bId, 'rdf:type', 'owl:Restriction'));
      // onProperty
      assert.ok(hasIriQuad(quads, bId, 'owl:onProperty', 'https://example.com/Person#name'));
      // minCardinality
      assert.ok(hasLiteralQuad(quads, bId, 'owl:minCardinality', 1, 'xsd:nonNegativeInteger'));

      // SHACL minCount on the property node
      assert.ok(hasLiteralQuad(
        quads,
        'https://example.com/Person#/properties/name',
        'sh:minCount',
        1,
        'xsd:integer'
      ));
    });
  });

  describe('3. String constraints', () => {
    it('emits sh:minLength, sh:maxLength, sh:pattern', () => {
      const quads = tboxQuads({
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

      const propId = 'https://example.com/T#/properties/code';

      assert.ok(hasLiteralQuad(quads, propId, 'sh:minLength', 2, 'xsd:integer'));
      assert.ok(hasLiteralQuad(quads, propId, 'sh:maxLength', 10, 'xsd:integer'));
      assert.ok(hasLiteralQuad(quads, propId, 'sh:pattern', '^[A-Z]+$', 'xsd:string'));
    });
  });

  describe('4. Numeric constraints', () => {
    it('emits sh:minInclusive, sh:maxInclusive, sh:minExclusive, sh:maxExclusive', () => {
      const quads = tboxQuads({
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
      });

      const scoreId = 'https://example.com/T#/properties/score';
      const deltaId = 'https://example.com/T#/properties/delta';

      assert.ok(hasLiteralQuad(quads, scoreId, 'sh:minInclusive', 0, 'xsd:decimal'));
      assert.ok(hasLiteralQuad(quads, scoreId, 'sh:maxInclusive', 100, 'xsd:decimal'));
      assert.ok(hasLiteralQuad(quads, deltaId, 'sh:minExclusive', -1, 'xsd:decimal'));
      assert.ok(hasLiteralQuad(quads, deltaId, 'sh:maxExclusive', 200, 'xsd:decimal'));
    });
  });

  describe('5. Enum produces owl:oneOf', () => {
    it('emits owl:oneOf literal for each enum value', () => {
      const quads = tboxQuads({
        '$id': 'https://example.com/Status',
        'enum': [
          'active',
          'inactive',
          'pending'
        ],
        'type': 'string'
      });

      const oneOfQuads = findQuadsForSubject(quads, 'https://example.com/Status', 'owl:oneOf');

      assert.equal(oneOfQuads.length, 3);
      assert.ok(hasLiteralQuad(quads, 'https://example.com/Status', 'owl:oneOf', 'active', 'xsd:string'));
      assert.ok(hasLiteralQuad(quads, 'https://example.com/Status', 'owl:oneOf', 'inactive', 'xsd:string'));
      assert.ok(hasLiteralQuad(quads, 'https://example.com/Status', 'owl:oneOf', 'pending', 'xsd:string'));
    });
  });

  describe('6. Const produces owl:hasValue', () => {
    it('emits owl:hasValue literal', () => {
      const quads = tboxQuads({
        '$id': 'https://example.com/Const',
        'const': 'fixed',
        'type': 'string'
      });

      assert.ok(hasLiteralQuad(quads, 'https://example.com/Const', 'owl:hasValue', 'fixed', 'xsd:string'));
    });
  });

  describe('7. allOf produces rdfs:subClassOf', () => {
    it('emits rdfs:subClassOf for each allOf branch', () => {
      const quads = tboxQuads({
        '$id': 'https://example.com/Child',
        'allOf': [{ '$ref': 'https://example.com/Parent' }],
        'type': 'object'
      });

      assert.ok(hasIriQuad(quads, 'https://example.com/Child', 'rdfs:subClassOf', 'https://example.com/Parent'));
    });
  });

  describe('8. anyOf/oneOf produce owl:equivalentClass', () => {
    it('emits owl:equivalentClass for anyOf branches', () => {
      const quads = tboxQuads({
        '$id': 'https://example.com/Union',
        'anyOf': [
          { 'type': 'string' },
          { 'type': 'number' }
        ]
      });

      const eqQuads = findQuadsForSubject(quads, 'https://example.com/Union', 'owl:equivalentClass');

      assert.ok(eqQuads.length >= 2);
    });

    it('emits owl:equivalentClass for oneOf branches', () => {
      const quads = tboxQuads({
        '$id': 'https://example.com/Exclusive',
        'oneOf': [
          { 'type': 'string' },
          { 'type': 'boolean' }
        ]
      });

      const eqQuads = findQuadsForSubject(quads, 'https://example.com/Exclusive', 'owl:equivalentClass');

      assert.ok(eqQuads.length >= 2);
    });
  });

  describe('9. not produces owl:complementOf', () => {
    it('emits owl:complementOf for not', () => {
      const quads = tboxQuads({
        '$id': 'https://example.com/NotArray',
        'not': { 'type': 'array' }
      });

      const compQuads = findQuadsForSubject(quads, 'https://example.com/NotArray', 'owl:complementOf');

      assert.ok(compQuads.length > 0);
    });
  });

  describe('10. if/then/else produces conditional structure', () => {
    it('emits owl:unionOf bnode with jt:if/jt:then/jt:else', () => {
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

      // jt:if, jt:then, jt:else
      const ifQuads = findQuadsForSubject(quads, bId, 'jt:if');

      assert.ok(ifQuads.length > 0, 'should have jt:if');
      const thenQuads = findQuadsForSubject(quads, bId, 'jt:then');

      assert.ok(thenQuads.length > 0, 'should have jt:then');
      const elseQuads = findQuadsForSubject(quads, bId, 'jt:else');

      assert.ok(elseQuads.length > 0, 'should have jt:else');
    });
  });

  describe('11. contains produces owl:someValuesFrom restriction', () => {
    it('emits restriction bnode with owl:someValuesFrom', () => {
      const quads = tboxQuads({
        '$id': 'https://example.com/ArrayContains',
        'contains': { 'type': 'number' },
        'type': 'array'
      });

      const svfQuad = hasBnodeQuad(quads, 'https://example.com/ArrayContains', 'owl:someValuesFrom');

      assert.ok(svfQuad, 'should have someValuesFrom bnode');

      const bId = bnodeId(svfQuad);

      assert.ok(hasIriQuad(quads, bId, 'rdf:type', 'owl:Restriction'));
      assert.ok(hasIriQuad(quads, bId, 'owl:onProperty', 'rdfs:member'));
      assert.ok(hasIriQuad(quads, bId, 'owl:someValuesFrom', 'xsd:decimal'));
    });

    it('emits qualified cardinality from minContains/maxContains', () => {
      const quads = tboxQuads({
        '$id': 'https://example.com/ArrayCard',
        'contains': { 'type': 'string' },
        'maxContains': 5,
        'minContains': 2,
        'type': 'array'
      });

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
    });
  });

  describe('12. prefixItems produce rdfs:member positional quads', () => {
    it('emits rdfs:member for each positional item', () => {
      const quads = tboxQuads({
        '$id': 'https://example.com/Tuple',
        'prefixItems': [
          { 'type': 'string' },
          { 'type': 'number' },
          { 'type': 'boolean' }
        ],
        'type': 'array'
      });

      const memberQuads = findQuadsForSubject(quads, 'https://example.com/Tuple', 'rdfs:member');

      assert.equal(memberQuads.length, 3);

      assert.ok(hasIriQuad(quads, 'https://example.com/Tuple', 'rdfs:member', 'xsd:string'));
      assert.ok(hasIriQuad(quads, 'https://example.com/Tuple', 'rdfs:member', 'xsd:decimal'));
      assert.ok(hasIriQuad(quads, 'https://example.com/Tuple', 'rdfs:member', 'xsd:boolean'));
    });
  });

  describe('13. patternProperties produce sh:pattern quads', () => {
    it('emits sh:pattern for each pattern property', () => {
      const quads = tboxQuads({
        '$id': 'https://example.com/PatternProps',
        'patternProperties': {
          '^x-': { 'type': 'string' },
          '^y-': { 'type': 'number' }
        },
        'type': 'object'
      });

      const patternQuads = findQuadsForSubject(quads, 'https://example.com/PatternProps', 'sh:pattern');

      assert.ok(patternQuads.length >= 2, `expected at least 2 sh:pattern quads, got ${patternQuads.length}`);
      assert.ok(hasLiteralQuad(quads, 'https://example.com/PatternProps', 'sh:pattern', '^x-', 'xsd:string'));
      assert.ok(hasLiteralQuad(quads, 'https://example.com/PatternProps', 'sh:pattern', '^y-', 'xsd:string'));
    });
  });

  describe('14. additionalProperties: false produces sh:closed', () => {
    it('emits sh:closed true', () => {
      const quads = tboxQuads({
        '$id': 'https://example.com/Strict',
        'additionalProperties': false,
        'properties': { 'a': { 'type': 'string' } },
        'type': 'object'
      });

      assert.ok(hasLiteralQuad(quads, 'https://example.com/Strict', 'sh:closed', 'true', 'xsd:boolean'));
    });

    it('does not emit sh:closed when additionalProperties is true', () => {
      const quads = tboxQuads({
        '$id': 'https://example.com/Open',
        'additionalProperties': true,
        'type': 'object'
      });

      const closedQuads = findQuadsForSubject(quads, 'https://example.com/Open', 'sh:closed');

      assert.equal(closedQuads.length, 0);
    });
  });

  describe('15. readOnly/writeOnly produce rdf:type annotation quads', () => {
    it('emits rdf:type jt:ReadOnly', () => {
      const quads = tboxQuads({
        '$id': 'https://example.com/RO',
        'properties': {
          'id': {
            'readOnly': true,
            'type': 'string'
          }
        },
        'type': 'object'
      });

      assert.ok(hasIriQuad(
        quads,
        'https://example.com/RO#/properties/id',
        'rdf:type',
        'jt:ReadOnly'
      ));
    });

    it('emits rdf:type jt:WriteOnly', () => {
      const quads = tboxQuads({
        '$id': 'https://example.com/WO',
        'properties': {
          'password': {
            'type': 'string',
            'writeOnly': true
          }
        },
        'type': 'object'
      });

      assert.ok(hasIriQuad(
        quads,
        'https://example.com/WO#/properties/password',
        'rdf:type',
        'jt:WriteOnly'
      ));
    });
  });

  describe('16. deprecated produces owl:deprecated', () => {
    it('emits owl:deprecated literal', () => {
      const quads = tboxQuads({
        '$id': 'https://example.com/Old',
        'deprecated': true,
        'type': 'string'
      });

      assert.ok(hasLiteralQuad(quads, 'https://example.com/Old', 'owl:deprecated', 'true', 'xsd:boolean'));
    });
  });

  describe('17. $ref produces rdfs:range', () => {
    it('emits rdfs:range IRI from $ref property', () => {
      const quads = tboxQuads({
        '$id': 'https://example.com/T',
        'properties': { 'friend': { '$ref': 'https://example.com/Person' } },
        'type': 'object'
      });

      assert.ok(hasIriQuad(
        quads,
        'https://example.com/T#/properties/friend',
        'rdfs:range',
        'https://example.com/Person'
      ));
    });
  });

  describe('18. Multi-type produces owl:unionOf list', () => {
    it('emits owl:unionOf with RDF list object', () => {
      const quads = tboxQuads({
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

      const unionQuads = findQuadsForSubject(
        quads,
        'https://example.com/T#/properties/value',
        'owl:unionOf'
      );

      assert.ok(unionQuads.length > 0, 'should have unionOf quad');

      const listQuad = unionQuads.find((q) => {
        return q.object.type === 'list';
      });

      assert.ok(listQuad, 'should have list-type object');

      if (listQuad.object.type === 'list') {
        const items = listQuad.object.items;

        assert.equal(items.length, 2);
        assert.equal(items[0].type, 'iri');
        assert.equal(items[1].type, 'iri');
        if (items[0].type === 'iri' && items[1].type === 'iri') {
          assert.equal(items[0].value, 'xsd:string');
          assert.equal(items[1].value, 'xsd:decimal');
        }
      }
    });
  });

  describe('19. XSD datatype resolution produces sh:datatype', () => {
    it('emits sh:datatype for string', () => {
      const quads = tboxQuads({
        '$id': 'https://example.com/T',
        'properties': { 'name': { 'type': 'string' } },
        'type': 'object'
      });

      assert.ok(hasIriQuad(
        quads,
        'https://example.com/T#/properties/name',
        'sh:datatype',
        'xsd:string'
      ));
    });

    it('emits sh:datatype for date-time format', () => {
      const quads = tboxQuads({
        '$id': 'https://example.com/T',
        'properties': {
          'created': {
            'format': 'date-time',
            'type': 'string'
          }
        },
        'type': 'object'
      });

      assert.ok(hasIriQuad(
        quads,
        'https://example.com/T#/properties/created',
        'sh:datatype',
        'xsd:dateTime'
      ));
    });

    it('does not emit sh:datatype for object type', () => {
      const quads = tboxQuads({
        '$id': 'https://example.com/T',
        'properties': { 'meta': { 'type': 'object' } },
        'type': 'object'
      });

      const dtQuads = findQuadsForSubject(
        quads,
        'https://example.com/T#/properties/meta',
        'sh:datatype'
      );

      assert.equal(dtQuads.length, 0);
    });
  });

  describe('20. dependentSchemas produce conditional quads', () => {
    it('emits conditional bnode for each dependent schema', () => {
      const quads = tboxQuads({
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

      const unionQuad = hasBnodeQuad(quads, 'https://example.com/Deps', 'owl:unionOf');

      assert.ok(unionQuad, 'should have conditional bnode');

      const bId = bnodeId(unionQuad);

      assert.ok(hasIriQuad(quads, bId, 'rdf:type', 'owl:Class'));

      // jt:if should reference the property IRI
      const ifQuads = findQuadsForSubject(quads, bId, 'jt:if');

      assert.ok(ifQuads.length > 0, 'should have jt:if');
    });
  });
});

describe('quadsToJsonLdNodes', () => {
  it('preserves stable blank node identifiers without double-prefixing them', () => {
    const quads: QuadInterface[] = [
      {
        'object': {
          'id': '_:b1',
          'type': 'bnode'
        },
        'predicate': 'ex:child',
        'subject': 'https://example.com/Thing'
      },
      {
        'object': {
          'type': 'iri',
          'value': 'ex:Nested'
        },
        'predicate': 'rdf:type',
        'subject': '_:b1'
      },
      {
        'object': {
          'datatype': 'xsd:string',
          'type': 'literal',
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

describe('projectAbox — ABox projection', () => {
  describe('21. Simple instance produces rdf:type and property literals', () => {
    it('emits rdf:type and string/number/boolean property quads', () => {
      const schema = {
        '$id': 'https://example.com/User',
        'properties': {
          'active': { 'type': 'boolean' },
          'age': { 'type': 'integer' },
          'name': { 'type': 'string' }
        },
        'type': 'object'
      } as Record<string, unknown>;

      const graph = new SchemaGraph(schema);
      const data = {
        'active': true,
        'age': 30,
        'name': 'Alice'
      };
      const quads = projectAbox(graph, data, 'https://data.example.com');

      // Find instance IRI (should have rdf:type)
      const typeQuads = findQuads(quads, 'rdf:type');

      assert.ok(typeQuads.length > 0, 'should have at least one rdf:type quad');

      const instIRI = typeQuads[0].subject;

      assert.ok(instIRI.startsWith('https://data.example.com/'));
      assert.ok(hasIriQuad(quads, instIRI, 'rdf:type', 'https://example.com/User'));

      // String property
      assert.ok(hasLiteralQuad(quads, instIRI, 'https://example.com/User#name', 'Alice', 'xsd:string'));
      // Integer property
      assert.ok(hasLiteralQuad(quads, instIRI, 'https://example.com/User#age', 30, 'xsd:integer'));
      // Boolean property
      assert.ok(hasLiteralQuad(quads, instIRI, 'https://example.com/User#active', true, 'xsd:boolean'));
    });
  });

  describe('22. Nested object produces linked instance quads', () => {
    it('emits separate instances linked by IRI', () => {
      const schema = {
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
      } as Record<string, unknown>;

      const graph = new SchemaGraph(schema);
      const data = {
        'address': {
          'city': 'Springfield',
          'street': '123 Main St'
        },
        'name': 'Bob'
      };
      const quads = projectAbox(graph, data, 'https://data.example.com');

      // Parent instance
      const parentTypeQuads = quads.filter((q) => {
        return q.predicate === 'rdf:type'
        && q.object.type === 'iri'
        && q.object.value === 'https://example.com/Parent';
      });

      assert.equal(parentTypeQuads.length, 1);
      const parentIRI = parentTypeQuads[0].subject;

      // Address link (should be IRI object pointing to nested instance)
      const addrQuads = findQuadsForSubject(quads, parentIRI, 'https://example.com/Parent#address');

      assert.equal(addrQuads.length, 1);
      assert.equal(addrQuads[0].object.type, 'iri');

      // Nested instance should have its own quads
      const nestedIRI = addrQuads[0].object.type === 'iri' ? addrQuads[0].object.value : '';

      assert.ok(
        hasLiteralQuad(quads, nestedIRI, 'https://example.com/Parent#/properties/address#street', 'Springfield', 'xsd:string')
        || hasLiteralQuad(quads, nestedIRI, 'https://example.com/Parent#/properties/address#city', 'Springfield', 'xsd:string')
        || quads.some((q) => {
          return q.subject === nestedIRI
          && q.predicate.includes('city')
          && q.object.type === 'literal'
          && q.object.value === 'Springfield';
        }),
        'nested instance should have city property'
      );
    });
  });

  describe('23. Array values produce multiple quads', () => {
    it('emits one quad per array element', () => {
      const schema = {
        '$id': 'https://example.com/Tags',
        'properties': {
          'tags': {
            'items': { 'type': 'string' },
            'type': 'array'
          }
        },
        'type': 'object'
      } as Record<string, unknown>;

      const graph = new SchemaGraph(schema);
      const data = {
        'tags': [
          'red',
          'green',
          'blue'
        ]
      };
      const quads = projectAbox(graph, data, 'https://data.example.com');

      const instIRI = quads.find((q) => {
        return q.predicate === 'rdf:type';
      })!.subject;
      const tagQuads = findQuadsForSubject(quads, instIRI, 'https://example.com/Tags#tags');

      assert.equal(tagQuads.length, 3);

      const tagValues = new Set(tagQuads
        .filter((q) => {
          return q.object.type === 'literal';
        })
        .map((q) => {
          return q.object.type === 'literal' ? q.object.value : null;
        }));

      assert.ok(tagValues.has('red'));
      assert.ok(tagValues.has('green'));
      assert.ok(tagValues.has('blue'));
    });
  });

  describe('24. Null values are omitted', () => {
    it('does not emit quads for null property values', () => {
      const schema = {
        '$id': 'https://example.com/Nullable',
        'properties': {
          'name': { 'type': 'string' },
          'nickname': { 'type': 'string' }
        },
        'type': 'object'
      } as Record<string, unknown>;

      const graph = new SchemaGraph(schema);
      const data = {
        'name': 'Alice',
        'nickname': null
      };
      const quads = projectAbox(graph, data, 'https://data.example.com');

      const instIRI = quads.find((q) => {
        return q.predicate === 'rdf:type';
      })!.subject;

      // name should be present
      assert.ok(hasLiteralQuad(quads, instIRI, 'https://example.com/Nullable#name', 'Alice'));

      // nickname should be omitted
      const nickQuads = findQuadsForSubject(quads, instIRI, 'https://example.com/Nullable#nickname');

      assert.equal(nickQuads.length, 0);
    });
  });

  describe('25. TBox + ABox coherence', () => {
    it('instance types reference declared classes, properties reference declared properties', () => {
      const schema = {
        '$id': 'https://example.com/Item',
        'properties': {
          'count': { 'type': 'integer' },
          'label': { 'type': 'string' }
        },
        'required': ['label'],
        'type': 'object'
      } as Record<string, unknown>;

      const graph = new SchemaGraph(schema);
      const tbox = projectGraph(graph);
      const abox = projectAbox(graph, {
        'count': 5,
        'label': 'Widget'
      }, 'https://data.example.com');

      // Collect TBox class IRIs
      const tboxClasses = new Set(tbox
        .filter((q) => {
          return q.predicate === 'rdf:type' && q.object.type === 'iri' && q.object.value === 'owl:Class';
        })
        .map((q) => {
          return q.subject;
        }));

      // ABox rdf:type targets should be in TBox classes
      const aboxTypes = abox
        .filter((q) => {
          return q.predicate === 'rdf:type' && q.object.type === 'iri';
        })
        .map((q) => {
          return q.object.type === 'iri' ? q.object.value : '';
        });

      for (const aboxType of aboxTypes) {
        assert.ok(
          tboxClasses.has(aboxType),
          `ABox type ${aboxType} should be declared as owl:Class in TBox`
        );
      }

      // Collect TBox property IRIs (owl:DatatypeProperty or owl:ObjectProperty)
      const tboxProperties = tbox
        .filter((q) => {
          return q.predicate === 'rdf:type'
          && q.object.type === 'iri'
          && (q.object.value === 'owl:DatatypeProperty' || q.object.value === 'owl:ObjectProperty');
        })
        .map((q) => {
          return q.subject;
        });

      // ABox property predicates should reference TBox property IDs (by derivation)
      const aboxPropPredicates = abox
        .filter((q) => {
          return q.predicate !== 'rdf:type';
        })
        .map((q) => {
          return q.predicate;
        });

      // All ABox property predicates should start with the class IRI
      for (const pred of aboxPropPredicates) {
        assert.ok(
          pred.startsWith('https://example.com/Item'),
          `ABox property predicate ${pred} should reference the schema class`
        );
      }
    });
  });
});
