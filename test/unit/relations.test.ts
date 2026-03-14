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
  return rels.filter((r) => {
    return r.predicate === predicate;
  });
}

describe('Enriched relations', () => {
  describe('if/then/else conditional', () => {
    it('produces conditional structure from if/then/else', () => {
      const rels = nodeRelations({
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

      const conditionals = findRelations(rels, 'owl:unionOf').filter((r) => {
        return r.metadata?.conditional === true;
      });

      assert.equal(conditionals.length, 1);
      assert.ok(conditionals[0].structure);
      assert.equal(conditionals[0].structure.kind, 'conditional');

      const struct = conditionals[0].structure as {
        'elseRef'?: string;
        'ifRef': string;
        'kind': 'conditional';
        'thenRef'?: string;
      };

      assert.ok(struct.ifRef);
      assert.ok(struct.thenRef);
      assert.ok(struct.elseRef);
    });

    it('produces conditional structure from if/then without else', () => {
      const rels = nodeRelations({
        '$id': 'https://example.com/PartialCond',
        'if': {
          'properties': { 'x': { 'const': 'a' } },
          'type': 'object'
        },
        'then': {
          'properties': { 'y': { 'type': 'string' } },
          'type': 'object'
        },
        'type': 'object'
      });

      const conditionals = findRelations(rels, 'owl:unionOf').filter((r) => {
        return r.metadata?.conditional === true;
      });

      assert.equal(conditionals.length, 1);
      const struct = conditionals[0].structure as {
        'elseRef'?: string;
        'ifRef': string;
        'kind': 'conditional';
        'thenRef'?: string;
      };

      assert.ok(struct.ifRef);
      assert.ok(struct.thenRef);
      assert.equal(struct.elseRef, undefined);
    });
  });

  describe('dependentSchemas', () => {
    it('produces conditional structure for each dependent schema entry', () => {
      const rels = nodeRelations({
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

      const depRels = findRelations(rels, 'owl:unionOf').filter((r) => {
        return r.metadata?.dependentSchema === true;
      });

      assert.equal(depRels.length, 1);
      assert.equal(depRels[0].metadata!.propertyName, 'address');
      assert.ok(depRels[0].structure);
      assert.equal(depRels[0].structure.kind, 'conditional');
    });
  });

  describe('contains', () => {
    it('produces someValuesFrom restriction from contains', () => {
      const rels = nodeRelations({
        '$id': 'https://example.com/ArrayContains',
        'contains': { 'type': 'number' },
        'type': 'array'
      });

      const svf = findRelations(rels, 'owl:someValuesFrom');

      assert.equal(svf.length, 1);
      assert.equal(svf[0].target, 'xsd:decimal');
      assert.ok(svf[0].structure);
      assert.equal(svf[0].structure.kind, 'restriction');

      const struct = svf[0].structure as {
        'constraint': string;
        'kind': 'restriction';
        'onProperty': string;
        'value': unknown;
      };

      assert.equal(struct.onProperty, 'rdfs:member');
    });

    it('produces qualified cardinality from minContains/maxContains', () => {
      const rels = nodeRelations({
        '$id': 'https://example.com/ArrayCard',
        'contains': { 'type': 'string' },
        'maxContains': 5,
        'minContains': 2,
        'type': 'array'
      });

      const minCard = findRelations(rels, 'owl:minQualifiedCardinality');
      const maxCard = findRelations(rels, 'owl:maxQualifiedCardinality');

      assert.equal(minCard.length, 1);
      assert.equal(minCard[0].target, '2');
      assert.equal(maxCard.length, 1);
      assert.equal(maxCard[0].target, '5');
    });
  });

  describe('prefixItems', () => {
    it('produces rdfs:member relations with positional metadata', () => {
      const rels = nodeRelations({
        '$id': 'https://example.com/Tuple',
        'prefixItems': [
          { 'type': 'string' },
          { 'type': 'number' },
          { 'type': 'boolean' }
        ],
        'type': 'array'
      });

      const members = findRelations(rels, 'rdfs:member');

      assert.equal(members.length, 3);
      assert.equal(members[0].metadata!.position, 0);
      assert.equal(members[0].metadata!.memberProperty, 'rdf:_1');
      assert.equal(members[0].target, 'xsd:string');
      assert.equal(members[1].metadata!.position, 1);
      assert.equal(members[1].metadata!.memberProperty, 'rdf:_2');
      assert.equal(members[1].target, 'xsd:decimal');
      assert.equal(members[2].metadata!.position, 2);
      assert.equal(members[2].metadata!.memberProperty, 'rdf:_3');
      assert.equal(members[2].target, 'xsd:boolean');
    });
  });

  describe('patternProperties', () => {
    it('produces sh:pattern relations with pattern metadata', () => {
      const rels = nodeRelations({
        '$id': 'https://example.com/PatternProps',
        'patternProperties': {
          '^x-': { 'type': 'string' },
          '^y-': { 'type': 'number' }
        },
        'type': 'object'
      });

      const patterns = findRelations(rels, 'sh:pattern').filter((r) => {
        return r.metadata?.patternProperty === true;
      });

      assert.equal(patterns.length, 2);
      assert.equal(patterns[0].metadata!.pattern, '^x-');
      assert.equal(patterns[1].metadata!.pattern, '^y-');
    });
  });

  describe('const', () => {
    it('produces owl:hasValue from const string', () => {
      const rels = nodeRelations({
        'const': 'active',
        'type': 'string'
      });

      const hasValue = findRelations(rels, 'owl:hasValue');

      assert.equal(hasValue.length, 1);
      assert.equal(hasValue[0].target, 'active');
    });

    it('produces owl:hasValue from const number', () => {
      const rels = nodeRelations({
        'const': 42,
        'type': 'number'
      });

      const hasValue = findRelations(rels, 'owl:hasValue');

      assert.equal(hasValue.length, 1);
      assert.equal(hasValue[0].target, '42');
    });

    it('produces owl:hasValue from const boolean', () => {
      const rels = nodeRelations({
        'const': true,
        'type': 'boolean'
      });

      const hasValue = findRelations(rels, 'owl:hasValue');

      assert.equal(hasValue.length, 1);
      assert.equal(hasValue[0].target, 'true');
    });
  });

  describe('property type classification', () => {
    it('classifies string property as owl:DatatypeProperty', () => {
      const rels = nodeRelations({
        '$id': 'https://example.com/T',
        'properties': { 'name': { 'type': 'string' } },
        'type': 'object'
      }, '/properties/name');

      const types = findRelations(rels, 'rdf:type');
      const datatypeProp = types.find((r) => {
        return r.target === 'owl:DatatypeProperty';
      });

      assert.ok(datatypeProp);
    });

    it('classifies number property as owl:DatatypeProperty', () => {
      const rels = nodeRelations({
        '$id': 'https://example.com/T',
        'properties': { 'age': { 'type': 'number' } },
        'type': 'object'
      }, '/properties/age');

      const types = findRelations(rels, 'rdf:type');

      assert.ok(types.some((r) => {
        return r.target === 'owl:DatatypeProperty';
      }));
    });

    it('classifies integer property as owl:DatatypeProperty', () => {
      const rels = nodeRelations({
        '$id': 'https://example.com/T',
        'properties': { 'count': { 'type': 'integer' } },
        'type': 'object'
      }, '/properties/count');

      const types = findRelations(rels, 'rdf:type');

      assert.ok(types.some((r) => {
        return r.target === 'owl:DatatypeProperty';
      }));
    });

    it('classifies boolean property as owl:DatatypeProperty', () => {
      const rels = nodeRelations({
        '$id': 'https://example.com/T',
        'properties': { 'active': { 'type': 'boolean' } },
        'type': 'object'
      }, '/properties/active');

      const types = findRelations(rels, 'rdf:type');

      assert.ok(types.some((r) => {
        return r.target === 'owl:DatatypeProperty';
      }));
    });

    it('classifies object property as owl:ObjectProperty', () => {
      const rels = nodeRelations({
        '$id': 'https://example.com/T',
        'properties': { 'address': { 'type': 'object' } },
        'type': 'object'
      }, '/properties/address');

      const types = findRelations(rels, 'rdf:type');

      assert.ok(types.some((r) => {
        return r.target === 'owl:ObjectProperty';
      }));
    });

    it('classifies array property as owl:ObjectProperty', () => {
      const rels = nodeRelations({
        '$id': 'https://example.com/T',
        'properties': {
          'tags': {
            'items': { 'type': 'string' },
            'type': 'array'
          }
        },
        'type': 'object'
      }, '/properties/tags');

      const types = findRelations(rels, 'rdf:type');

      assert.ok(types.some((r) => {
        return r.target === 'owl:ObjectProperty';
      }));
    });

    it('classifies $ref property as owl:ObjectProperty', () => {
      const rels = nodeRelations({
        '$id': 'https://example.com/T',
        'properties': { 'parent': { '$ref': 'https://example.com/T' } },
        'type': 'object'
      }, '/properties/parent');

      const types = findRelations(rels, 'rdf:type');

      assert.ok(types.some((r) => {
        return r.target === 'owl:ObjectProperty';
      }));
    });

    it('classifies untyped property as owl:ObjectProperty', () => {
      const rels = nodeRelations({
        '$id': 'https://example.com/T',
        'properties': { 'meta': {} },
        'type': 'object'
      }, '/properties/meta');

      const types = findRelations(rels, 'rdf:type');

      assert.ok(types.some((r) => {
        return r.target === 'owl:ObjectProperty';
      }));
    });

    it('does not classify non-property nodes', () => {
      const rels = nodeRelations({
        '$id': 'https://example.com/T',
        'type': 'object'
      });

      const types = findRelations(rels, 'rdf:type').filter((r) => {
        return r.target === 'owl:ObjectProperty' || r.target === 'owl:DatatypeProperty';
      });

      assert.equal(types.length, 0);
    });
  });

  describe('property range resolution', () => {
    it('produces rdfs:range from $ref', () => {
      const rels = nodeRelations({
        '$id': 'https://example.com/T',
        'properties': { 'parent': { '$ref': 'https://example.com/Other' } },
        'type': 'object'
      }, '/properties/parent');

      const ranges = findRelations(rels, 'rdfs:range');

      assert.equal(ranges.length, 1);
      assert.equal(ranges[0].target, 'https://example.com/Other');
      assert.equal(ranges[0].metadata?.fromRef, true);
    });

    it('produces sh:datatype from XSD type resolution', () => {
      const rels = nodeRelations({
        '$id': 'https://example.com/T',
        'properties': { 'name': { 'type': 'string' } },
        'type': 'object'
      }, '/properties/name');

      const datatypes = findRelations(rels, 'sh:datatype');

      assert.equal(datatypes.length, 1);
      assert.equal(datatypes[0].target, 'xsd:string');
    });

    it('produces sh:datatype for integer type', () => {
      const rels = nodeRelations({ 'type': 'integer' });

      const datatypes = findRelations(rels, 'sh:datatype');

      assert.equal(datatypes.length, 1);
      assert.equal(datatypes[0].target, 'xsd:integer');
    });

    it('produces sh:datatype for number type', () => {
      const rels = nodeRelations({ 'type': 'number' });

      const datatypes = findRelations(rels, 'sh:datatype');

      assert.equal(datatypes.length, 1);
      assert.equal(datatypes[0].target, 'xsd:decimal');
    });

    it('produces sh:datatype for boolean type', () => {
      const rels = nodeRelations({ 'type': 'boolean' });

      const datatypes = findRelations(rels, 'sh:datatype');

      assert.equal(datatypes.length, 1);
      assert.equal(datatypes[0].target, 'xsd:boolean');
    });

    it('produces sh:datatype with format-specific XSD type', () => {
      const rels = nodeRelations({
        'format': 'date-time',
        'type': 'string'
      });

      const datatypes = findRelations(rels, 'sh:datatype');

      assert.equal(datatypes.length, 1);
      assert.equal(datatypes[0].target, 'xsd:dateTime');
    });

    it('does not produce sh:datatype when $ref is present', () => {
      const rels = nodeRelations({ '$ref': 'https://example.com/Other' });

      const datatypes = findRelations(rels, 'sh:datatype');

      assert.equal(datatypes.length, 0);
    });

    it('does not produce sh:datatype for object or array types', () => {
      const objRels = nodeRelations({ 'type': 'object' });
      const arrRels = nodeRelations({ 'type': 'array' });

      assert.equal(findRelations(objRels, 'sh:datatype').length, 0);
      assert.equal(findRelations(arrRels, 'sh:datatype').length, 0);
    });
  });

  describe('readOnly / writeOnly annotations', () => {
    it('produces rdf:type jt:ReadOnly from readOnly', () => {
      const rels = nodeRelations({
        'readOnly': true,
        'type': 'string'
      });

      const types = findRelations(rels, 'rdf:type');

      assert.ok(types.some((r) => {
        return r.target === 'jt:ReadOnly';
      }));
    });

    it('produces rdf:type jt:WriteOnly from writeOnly', () => {
      const rels = nodeRelations({
        'type': 'string',
        'writeOnly': true
      });

      const types = findRelations(rels, 'rdf:type');

      assert.ok(types.some((r) => {
        return r.target === 'jt:WriteOnly';
      }));
    });

    it('does not produce readOnly/writeOnly annotations when false', () => {
      const rels = nodeRelations({ 'type': 'string' });

      const types = findRelations(rels, 'rdf:type');

      assert.ok(!types.some((r) => {
        return r.target === 'jt:ReadOnly';
      }));
      assert.ok(!types.some((r) => {
        return r.target === 'jt:WriteOnly';
      }));
    });
  });

  describe('sh:closed from additionalProperties', () => {
    it('produces sh:closed when additionalProperties is false', () => {
      const rels = nodeRelations({
        '$id': 'https://example.com/Strict',
        'additionalProperties': false,
        'properties': { 'a': { 'type': 'string' } },
        'type': 'object'
      });

      const closed = findRelations(rels, 'sh:closed');

      assert.equal(closed.length, 1);
      assert.equal(closed[0].target, 'true');
    });

    it('does not produce sh:closed when additionalProperties is true', () => {
      const rels = nodeRelations({
        'additionalProperties': true,
        'type': 'object'
      });

      const closed = findRelations(rels, 'sh:closed');

      assert.equal(closed.length, 0);
    });

    it('does not produce sh:closed when additionalProperties is a schema', () => {
      const rels = nodeRelations({
        'additionalProperties': { 'type': 'string' },
        'type': 'object'
      });

      const closed = findRelations(rels, 'sh:closed');

      assert.equal(closed.length, 0);
    });
  });

  describe('string constraint relations', () => {
    it('produces sh:pattern from pattern', () => {
      const rels = nodeRelations({
        'pattern': '^[A-Z]+$',
        'type': 'string'
      });

      const patterns = findRelations(rels, 'sh:pattern').filter((r) => {
        return r.metadata?.patternProperty !== true;
      });

      assert.equal(patterns.length, 1);
      assert.equal(patterns[0].target, '^[A-Z]+$');
    });

    it('produces sh:minLength from minLength', () => {
      const rels = nodeRelations({
        'minLength': 3,
        'type': 'string'
      });

      const minLen = findRelations(rels, 'sh:minLength');

      assert.equal(minLen.length, 1);
      assert.equal(minLen[0].target, '3');
    });

    it('produces sh:maxLength from maxLength', () => {
      const rels = nodeRelations({
        'maxLength': 100,
        'type': 'string'
      });

      const maxLen = findRelations(rels, 'sh:maxLength');

      assert.equal(maxLen.length, 1);
      assert.equal(maxLen[0].target, '100');
    });
  });

  describe('numeric constraint relations', () => {
    it('produces sh:minInclusive from minimum', () => {
      const rels = nodeRelations({
        'minimum': 0,
        'type': 'number'
      });

      const minInc = findRelations(rels, 'sh:minInclusive');

      assert.equal(minInc.length, 1);
      assert.equal(minInc[0].target, '0');
    });

    it('produces sh:maxInclusive from maximum', () => {
      const rels = nodeRelations({
        'maximum': 100,
        'type': 'number'
      });

      const maxInc = findRelations(rels, 'sh:maxInclusive');

      assert.equal(maxInc.length, 1);
      assert.equal(maxInc[0].target, '100');
    });

    it('produces sh:minExclusive from exclusiveMinimum', () => {
      const rels = nodeRelations({
        'exclusiveMinimum': -1,
        'type': 'number'
      });

      const minExc = findRelations(rels, 'sh:minExclusive');

      assert.equal(minExc.length, 1);
      assert.equal(minExc[0].target, '-1');
    });

    it('produces sh:maxExclusive from exclusiveMaximum', () => {
      const rels = nodeRelations({
        'exclusiveMaximum': 200,
        'type': 'number'
      });

      const maxExc = findRelations(rels, 'sh:maxExclusive');

      assert.equal(maxExc.length, 1);
      assert.equal(maxExc[0].target, '200');
    });
  });

  describe('property cardinality relations', () => {
    it('produces sh:minCount 1 for required properties', () => {
      const rels = nodeRelations({
        '$id': 'https://example.com/T',
        'properties': { 'name': { 'type': 'string' } },
        'required': ['name'],
        'type': 'object'
      }, '/properties/name');

      const minCount = findRelations(rels, 'sh:minCount');

      assert.equal(minCount.length, 1);
      assert.equal(minCount[0].target, '1');
    });

    it('does not produce sh:minCount for non-required properties', () => {
      const rels = nodeRelations({
        '$id': 'https://example.com/T',
        'properties': { 'name': { 'type': 'string' } },
        'type': 'object'
      }, '/properties/name');

      const minCount = findRelations(rels, 'sh:minCount');

      assert.equal(minCount.length, 0);
    });

    it('produces sh:maxCount 1 for non-array properties', () => {
      const rels = nodeRelations({
        '$id': 'https://example.com/T',
        'properties': { 'name': { 'type': 'string' } },
        'type': 'object'
      }, '/properties/name');

      const maxCount = findRelations(rels, 'sh:maxCount');

      assert.equal(maxCount.length, 1);
      assert.equal(maxCount[0].target, '1');
    });

    it('does not produce sh:maxCount for array properties', () => {
      const rels = nodeRelations({
        '$id': 'https://example.com/T',
        'properties': {
          'tags': {
            'items': { 'type': 'string' },
            'type': 'array'
          }
        },
        'type': 'object'
      }, '/properties/tags');

      const maxCount = findRelations(rels, 'sh:maxCount');

      assert.equal(maxCount.length, 0);
    });
  });

  describe('multi-type union relations', () => {
    it('produces owl:unionOf for multi-type properties', () => {
      const rels = nodeRelations({
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
      }, '/properties/value');

      const unions = findRelations(rels, 'owl:unionOf').filter((r) => {
        return r.structure?.kind === 'list';
      });

      assert.equal(unions.length, 1);
      const struct = unions[0].structure as { 'kind': 'list';
        'members': string[] };

      assert.deepEqual(struct.members, [
        'xsd:string',
        'xsd:decimal'
      ]);
    });

    it('does not produce owl:unionOf for single-type properties', () => {
      const rels = nodeRelations({
        '$id': 'https://example.com/T',
        'properties': { 'name': { 'type': 'string' } },
        'type': 'object'
      }, '/properties/name');

      const unions = findRelations(rels, 'owl:unionOf').filter((r) => {
        return r.structure?.kind === 'list';
      });

      assert.equal(unions.length, 0);
    });

    it('filters out null from union type members', () => {
      const rels = nodeRelations({
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
      }, '/properties/value');

      const unions = findRelations(rels, 'owl:unionOf').filter((r) => {
        return r.structure?.kind === 'list';
      });

      assert.equal(unions.length, 1);
      const struct = unions[0].structure as { 'kind': 'list';
        'members': string[] };

      assert.deepEqual(struct.members, [
        'xsd:string',
        'xsd:decimal'
      ]);
    });
  });

  describe('$ref range on property', () => {
    it('produces rdfs:range with fromRef metadata for $ref', () => {
      const rels = nodeRelations({
        '$id': 'https://example.com/T',
        'properties': { 'friend': { '$ref': 'https://example.com/Person' } },
        'type': 'object'
      }, '/properties/friend');

      const ranges = findRelations(rels, 'rdfs:range');

      assert.equal(ranges.length, 1);
      assert.equal(ranges[0].target, 'https://example.com/Person');
      assert.equal(ranges[0].metadata?.fromRef, true);
    });
  });

  describe('existing relation predicates remain correct', () => {
    it('preserves rdfs:label from title', () => {
      const rels = nodeRelations({
        'title': 'MyClass',
        'type': 'object'
      });

      assert.ok(findRelations(rels, 'rdfs:label').some((r) => {
        return r.target === 'MyClass';
      }));
    });

    it('preserves rdfs:comment from description', () => {
      const rels = nodeRelations({
        'description': 'A thing',
        'type': 'object'
      });

      assert.ok(findRelations(rels, 'rdfs:comment').some((r) => {
        return r.target === 'A thing';
      }));
    });

    it('preserves owl:deprecated', () => {
      const rels = nodeRelations({
        'deprecated': true,
        'type': 'string'
      });

      assert.ok(findRelations(rels, 'owl:deprecated').length > 0);
    });

    it('preserves rdfs:subClassOf from allOf', () => {
      const rels = nodeRelations({
        'allOf': [{ 'type': 'object' as const }],
        'type': 'object' as const
      });

      assert.ok(findRelations(rels, 'rdfs:subClassOf').length > 0);
    });

    it('preserves owl:equivalentClass from anyOf', () => {
      const rels = nodeRelations({
        'anyOf': [
          { 'type': 'string' as const },
          { 'type': 'number' as const }
        ]
      });

      assert.ok(findRelations(rels, 'owl:equivalentClass').length > 0);
    });

    it('preserves owl:complementOf from not', () => {
      const rels = nodeRelations({ 'not': { 'type': 'array' as const } });

      assert.ok(findRelations(rels, 'owl:complementOf').length > 0);
    });

    it('preserves owl:Restriction from required', () => {
      const rels = nodeRelations({
        'properties': { 'name': { 'type': 'string' as const } },
        'required': ['name'],
        'type': 'object' as const
      });

      assert.ok(findRelations(rels, 'owl:Restriction').length > 0);
    });

    it('preserves owl:oneOf from enum', () => {
      const rels = nodeRelations({
        'enum': [
          'a',
          'b'
        ],
        'type': 'string' as const
      });

      assert.equal(findRelations(rels, 'owl:oneOf').length, 2);
    });

    it('preserves owl:disjointWith', () => {
      const rels = nodeRelations({
        'disjointWith': 'https://example.com/Other',
        'type': 'object' as const
      });

      assert.ok(findRelations(rels, 'owl:disjointWith').length > 0);
    });

    it('preserves owl:inverseOf', () => {
      const rels = nodeRelations({
        'inverseOf': 'https://example.com/inverse',
        'type': 'string' as const
      });

      assert.ok(findRelations(rels, 'owl:inverseOf').length > 0);
    });

    it('preserves owl:TransitiveProperty', () => {
      const rels = nodeRelations({
        'transitive': true,
        'type': 'string' as const
      });

      assert.ok(findRelations(rels, 'owl:TransitiveProperty').length > 0);
    });

    it('preserves owl:SymmetricProperty', () => {
      const rels = nodeRelations({
        'symmetric': true,
        'type': 'string' as const
      });

      assert.ok(findRelations(rels, 'owl:SymmetricProperty').length > 0);
    });
  });

  describe('comprehensive integration', () => {
    it('produces all expected relations for a complex schema', () => {
      const allRels = graphRelations({
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
        'then': {
          'properties': { 'employeeId': { 'type': 'string' } },
          'type': 'object'
        },
        'title': 'Person',
        'type': 'object'
      });

      // Root node has label, comment, closed, restriction, conditional
      assert.ok(allRels.some((r) => {
        return r.predicate === 'rdfs:label' && r.target === 'Person';
      }));
      assert.ok(allRels.some((r) => {
        return r.predicate === 'rdfs:comment' && r.target === 'A person entity';
      }));
      assert.ok(allRels.some((r) => {
        return r.predicate === 'sh:closed';
      }));
      assert.ok(allRels.some((r) => {
        return r.predicate === 'owl:Restriction';
      }));
      assert.ok(allRels.some((r) => {
        return r.predicate === 'owl:unionOf' && r.metadata?.conditional === true;
      }));

      // Property nodes have type classification
      assert.ok(allRels.some((r) => {
        return r.predicate === 'rdf:type' && r.target === 'owl:DatatypeProperty';
      }));
      assert.ok(allRels.some((r) => {
        return r.predicate === 'rdf:type' && r.target === 'owl:ObjectProperty';
      }));

      // String constraints on name
      assert.ok(allRels.some((r) => {
        return r.predicate === 'sh:minLength' && r.target === '1';
      }));
      assert.ok(allRels.some((r) => {
        return r.predicate === 'sh:maxLength' && r.target === '100';
      }));
      assert.ok(allRels.some((r) => {
        return r.predicate === 'sh:pattern' && r.target === '^[A-Z]';
      }));

      // Numeric constraints on age
      assert.ok(allRels.some((r) => {
        return r.predicate === 'sh:minInclusive' && r.target === '0';
      }));
      assert.ok(allRels.some((r) => {
        return r.predicate === 'sh:maxInclusive' && r.target === '150';
      }));

      // $ref range on manager
      assert.ok(allRels.some((r) => {
        return r.predicate === 'rdfs:range'
        && r.target === 'https://example.com/Person'
        && r.metadata?.fromRef === true;
      }));

      // const on status
      assert.ok(allRels.some((r) => {
        return r.predicate === 'owl:hasValue' && r.target === 'active';
      }));

      // Cardinality
      assert.ok(allRels.some((r) => {
        return r.predicate === 'sh:minCount' && r.target === '1';
      }));
      assert.ok(allRels.some((r) => {
        return r.predicate === 'sh:maxCount' && r.target === '1';
      }));
    });
  });
});
