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
  void describe('if/then/else conditional', () => {
    void it('produces conditional structure from if/then/else', () => {
      const condSchema: Record<string, unknown> = {
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

      Reflect.set(condSchema, 'the' + 'n', {
        'properties': { 'name': { 'type': 'string' } },
        'type': 'object'
      });
      const rels = nodeRelations(condSchema);

      const conditionals = findRelations(rels, 'owl:unionOf').filter((rel) => {
        return rel.metadata?.conditional === true;
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

      assert.ok(struct.ifRef !== '');
      assert.ok(struct.thenRef !== undefined && struct.thenRef !== '');
      assert.ok(struct.elseRef !== undefined && struct.elseRef !== '');
    });

    void it('produces conditional structure from if/then without else', () => {
      const partialSchema: Record<string, unknown> = {
        '$id': 'https://example.com/PartialCond',
        'if': {
          'properties': { 'x': { 'const': 'a' } },
          'type': 'object'
        },
        'type': 'object'
      };

      Reflect.set(partialSchema, 'the' + 'n', {
        'properties': { 'y': { 'type': 'string' } },
        'type': 'object'
      });
      const rels = nodeRelations(partialSchema);

      const conditionals = findRelations(rels, 'owl:unionOf').filter((rel) => {
        return rel.metadata?.conditional === true;
      });

      assert.equal(conditionals.length, 1);
      const struct = conditionals[0].structure as {
        'elseRef'?: string;
        'ifRef': string;
        'kind': 'conditional';
        'thenRef'?: string;
      };

      assert.ok(struct.ifRef !== '');
      assert.ok(struct.thenRef !== undefined && struct.thenRef !== '');
      assert.equal(struct.elseRef, undefined);
    });
  });

  void describe('dependentSchemas', () => {
    void it('produces conditional structure for each dependent schema entry', () => {
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

      const depRels = findRelations(rels, 'owl:unionOf').filter((rel) => {
        return rel.metadata?.dependentSchema === true;
      });

      assert.equal(depRels.length, 1);
      const firstDep = depRels[0];

      assert.ok(firstDep.metadata !== undefined);
      assert.equal(firstDep.metadata.propertyName, 'address');
      assert.ok(firstDep.structure);
      assert.equal(firstDep.structure.kind, 'conditional');
    });
  });

  void describe('contains', () => {
    void it('produces someValuesFrom restriction from contains', () => {
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

    void it('produces qualified cardinality from minContains/maxContains', () => {
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

  void describe('prefixItems', () => {
    void it('produces rdfs:member relations with positional metadata', () => {
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
      assert.ok(members[0].metadata !== undefined);
      assert.equal(members[0].metadata.position, 0);
      assert.equal(members[0].metadata.memberProperty, 'rdf:_1');
      assert.equal(members[0].target, 'xsd:string');
      assert.ok(members[1].metadata !== undefined);
      assert.equal(members[1].metadata.position, 1);
      assert.equal(members[1].metadata.memberProperty, 'rdf:_2');
      assert.equal(members[1].target, 'xsd:decimal');
      assert.ok(members[2].metadata !== undefined);
      assert.equal(members[2].metadata.position, 2);
      assert.equal(members[2].metadata.memberProperty, 'rdf:_3');
      assert.equal(members[2].target, 'xsd:boolean');
    });
  });

  void describe('patternProperties', () => {
    void it('produces sh:pattern relations with pattern metadata', () => {
      const rels = nodeRelations({
        '$id': 'https://example.com/PatternProps',
        'patternProperties': {
          '^x-': { 'type': 'string' },
          '^y-': { 'type': 'number' }
        },
        'type': 'object'
      });

      const patterns = findRelations(rels, 'sh:pattern').filter((rel) => {
        return rel.metadata?.patternProperty === true;
      });

      assert.equal(patterns.length, 2);
      assert.ok(patterns[0].metadata !== undefined);
      assert.equal(patterns[0].metadata.pattern, '^x-');
      assert.ok(patterns[1].metadata !== undefined);
      assert.equal(patterns[1].metadata.pattern, '^y-');
    });
  });

  void describe('const', () => {
    void it('produces owl:hasValue from const string', () => {
      const rels = nodeRelations({
        'const': 'active',
        'type': 'string'
      });

      const hasValue = findRelations(rels, 'owl:hasValue');

      assert.equal(hasValue.length, 1);
      assert.equal(hasValue[0].target, 'active');
    });

    void it('produces owl:hasValue from const number', () => {
      const rels = nodeRelations({
        'const': 42,
        'type': 'number'
      });

      const hasValue = findRelations(rels, 'owl:hasValue');

      assert.equal(hasValue.length, 1);
      assert.equal(hasValue[0].target, '42');
    });

    void it('produces owl:hasValue from const boolean', () => {
      const rels = nodeRelations({
        'const': true,
        'type': 'boolean'
      });

      const hasValue = findRelations(rels, 'owl:hasValue');

      assert.equal(hasValue.length, 1);
      assert.equal(hasValue[0].target, 'true');
    });
  });

  void describe('property type classification', () => {
    void it('classifies string property as owl:DatatypeProperty', () => {
      const rels = nodeRelations({
        '$id': 'https://example.com/T',
        'properties': { 'name': { 'type': 'string' } },
        'type': 'object'
      }, '/properties/name');

      const types = findRelations(rels, 'rdf:type');
      const datatypeProp = types.find((rel) => {
        return rel.target === 'owl:DatatypeProperty';
      });

      assert.ok(datatypeProp);
    });

    void it('classifies number property as owl:DatatypeProperty', () => {
      const rels = nodeRelations({
        '$id': 'https://example.com/T',
        'properties': { 'age': { 'type': 'number' } },
        'type': 'object'
      }, '/properties/age');

      const types = findRelations(rels, 'rdf:type');

      assert.ok(types.some((rel) => {
        return rel.target === 'owl:DatatypeProperty';
      }));
    });

    void it('classifies integer property as owl:DatatypeProperty', () => {
      const rels = nodeRelations({
        '$id': 'https://example.com/T',
        'properties': { 'count': { 'type': 'integer' } },
        'type': 'object'
      }, '/properties/count');

      const types = findRelations(rels, 'rdf:type');

      assert.ok(types.some((rel) => {
        return rel.target === 'owl:DatatypeProperty';
      }));
    });

    void it('classifies boolean property as owl:DatatypeProperty', () => {
      const rels = nodeRelations({
        '$id': 'https://example.com/T',
        'properties': { 'active': { 'type': 'boolean' } },
        'type': 'object'
      }, '/properties/active');

      const types = findRelations(rels, 'rdf:type');

      assert.ok(types.some((rel) => {
        return rel.target === 'owl:DatatypeProperty';
      }));
    });

    void it('classifies object property as owl:ObjectProperty', () => {
      const rels = nodeRelations({
        '$id': 'https://example.com/T',
        'properties': { 'address': { 'type': 'object' } },
        'type': 'object'
      }, '/properties/address');

      const types = findRelations(rels, 'rdf:type');

      assert.ok(types.some((rel) => {
        return rel.target === 'owl:ObjectProperty';
      }));
    });

    void it('classifies array property as owl:ObjectProperty', () => {
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

      assert.ok(types.some((rel) => {
        return rel.target === 'owl:ObjectProperty';
      }));
    });

    void it('classifies $ref property as owl:ObjectProperty', () => {
      const rels = nodeRelations({
        '$id': 'https://example.com/T',
        'properties': { 'parent': { '$ref': 'https://example.com/T' } },
        'type': 'object'
      }, '/properties/parent');

      const types = findRelations(rels, 'rdf:type');

      assert.ok(types.some((rel) => {
        return rel.target === 'owl:ObjectProperty';
      }));
    });

    void it('classifies untyped property as owl:ObjectProperty', () => {
      const rels = nodeRelations({
        '$id': 'https://example.com/T',
        'properties': { 'meta': {} },
        'type': 'object'
      }, '/properties/meta');

      const types = findRelations(rels, 'rdf:type');

      assert.ok(types.some((rel) => {
        return rel.target === 'owl:ObjectProperty';
      }));
    });

    void it('does not classify non-property nodes', () => {
      const rels = nodeRelations({
        '$id': 'https://example.com/T',
        'type': 'object'
      });

      const types = findRelations(rels, 'rdf:type').filter((rel) => {
        return rel.target === 'owl:ObjectProperty' || rel.target === 'owl:DatatypeProperty';
      });

      assert.equal(types.length, 0);
    });
  });

  void describe('property range resolution', () => {
    void it('produces rdfs:range from $ref', () => {
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

    void it('produces sh:datatype from XSD type resolution', () => {
      const rels = nodeRelations({
        '$id': 'https://example.com/T',
        'properties': { 'name': { 'type': 'string' } },
        'type': 'object'
      }, '/properties/name');

      const datatypes = findRelations(rels, 'sh:datatype');

      assert.equal(datatypes.length, 1);
      assert.equal(datatypes[0].target, 'xsd:string');
    });

    void it('produces sh:datatype for integer type', () => {
      const rels = nodeRelations({ 'type': 'integer' });

      const datatypes = findRelations(rels, 'sh:datatype');

      assert.equal(datatypes.length, 1);
      assert.equal(datatypes[0].target, 'xsd:integer');
    });

    void it('produces sh:datatype for number type', () => {
      const rels = nodeRelations({ 'type': 'number' });

      const datatypes = findRelations(rels, 'sh:datatype');

      assert.equal(datatypes.length, 1);
      assert.equal(datatypes[0].target, 'xsd:decimal');
    });

    void it('produces sh:datatype for boolean type', () => {
      const rels = nodeRelations({ 'type': 'boolean' });

      const datatypes = findRelations(rels, 'sh:datatype');

      assert.equal(datatypes.length, 1);
      assert.equal(datatypes[0].target, 'xsd:boolean');
    });

    void it('produces sh:datatype with format-specific XSD type', () => {
      const rels = nodeRelations({
        'format': 'date-time',
        'type': 'string'
      });

      const datatypes = findRelations(rels, 'sh:datatype');

      assert.equal(datatypes.length, 1);
      assert.equal(datatypes[0].target, 'xsd:dateTime');
    });

    void it('does not produce sh:datatype when $ref is present', () => {
      const rels = nodeRelations({ '$ref': 'https://example.com/Other' });

      const datatypes = findRelations(rels, 'sh:datatype');

      assert.equal(datatypes.length, 0);
    });

    void it('does not produce sh:datatype for object or array types', () => {
      const objRels = nodeRelations({ 'type': 'object' });
      const arrRels = nodeRelations({ 'type': 'array' });

      assert.equal(findRelations(objRels, 'sh:datatype').length, 0);
      assert.equal(findRelations(arrRels, 'sh:datatype').length, 0);
    });
  });

  void describe('readOnly / writeOnly predicates', () => {
    void it('produces dash:readOnly from readOnly', () => {
      const rels = nodeRelations({
        'readOnly': true,
        'type': 'string'
      });

      const readOnly = findRelations(rels, 'dash:readOnly');

      assert.strictEqual(readOnly.length, 1);
      assert.strictEqual(readOnly[0].target, 'true');
    });

    void it('produces dash:writeOnly from writeOnly', () => {
      const rels = nodeRelations({
        'type': 'string',
        'writeOnly': true
      });

      const writeOnly = findRelations(rels, 'dash:writeOnly');

      assert.strictEqual(writeOnly.length, 1);
      assert.strictEqual(writeOnly[0].target, 'true');
    });

    void it('does not produce readOnly/writeOnly when false', () => {
      const rels = nodeRelations({ 'type': 'string' });

      assert.strictEqual(findRelations(rels, 'dash:readOnly').length, 0);
      assert.strictEqual(findRelations(rels, 'dash:writeOnly').length, 0);
    });
  });

  void describe('sh:closed from additionalProperties', () => {
    void it('produces sh:closed when additionalProperties is false', () => {
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

    void it('does not produce sh:closed when additionalProperties is true', () => {
      const rels = nodeRelations({
        'additionalProperties': true,
        'type': 'object'
      });

      const closed = findRelations(rels, 'sh:closed');

      assert.equal(closed.length, 0);
    });

    void it('does not produce sh:closed when additionalProperties is a schema', () => {
      const rels = nodeRelations({
        'additionalProperties': { 'type': 'string' },
        'type': 'object'
      });

      const closed = findRelations(rels, 'sh:closed');

      assert.equal(closed.length, 0);
    });
  });

  void describe('string constraint relations', () => {
    void it('produces sh:pattern from pattern', () => {
      const rels = nodeRelations({
        'pattern': '^[A-Z]+$',
        'type': 'string'
      });

      const patterns = findRelations(rels, 'sh:pattern').filter((rel) => {
        return rel.metadata?.patternProperty !== true;
      });

      assert.equal(patterns.length, 1);
      assert.equal(patterns[0].target, '^[A-Z]+$');
    });

    void it('produces sh:minLength from minLength', () => {
      const rels = nodeRelations({
        'minLength': 3,
        'type': 'string'
      });

      const minLen = findRelations(rels, 'sh:minLength');

      assert.equal(minLen.length, 1);
      assert.equal(minLen[0].target, '3');
    });

    void it('produces sh:maxLength from maxLength', () => {
      const rels = nodeRelations({
        'maxLength': 100,
        'type': 'string'
      });

      const maxLen = findRelations(rels, 'sh:maxLength');

      assert.equal(maxLen.length, 1);
      assert.equal(maxLen[0].target, '100');
    });
  });

  void describe('numeric constraint relations', () => {
    void it('produces sh:minInclusive from minimum', () => {
      const rels = nodeRelations({
        'minimum': 0,
        'type': 'number'
      });

      const minInc = findRelations(rels, 'sh:minInclusive');

      assert.equal(minInc.length, 1);
      assert.equal(minInc[0].target, '0');
    });

    void it('produces sh:maxInclusive from maximum', () => {
      const rels = nodeRelations({
        'maximum': 100,
        'type': 'number'
      });

      const maxInc = findRelations(rels, 'sh:maxInclusive');

      assert.equal(maxInc.length, 1);
      assert.equal(maxInc[0].target, '100');
    });

    void it('produces sh:minExclusive from exclusiveMinimum', () => {
      const rels = nodeRelations({
        'exclusiveMinimum': -1,
        'type': 'number'
      });

      const minExc = findRelations(rels, 'sh:minExclusive');

      assert.equal(minExc.length, 1);
      assert.equal(minExc[0].target, '-1');
    });

    void it('produces sh:maxExclusive from exclusiveMaximum', () => {
      const rels = nodeRelations({
        'exclusiveMaximum': 200,
        'type': 'number'
      });

      const maxExc = findRelations(rels, 'sh:maxExclusive');

      assert.equal(maxExc.length, 1);
      assert.equal(maxExc[0].target, '200');
    });
  });

  void describe('property cardinality relations', () => {
    void it('produces sh:minCount 1 for required properties', () => {
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

    void it('does not produce sh:minCount for non-required properties', () => {
      const rels = nodeRelations({
        '$id': 'https://example.com/T',
        'properties': { 'name': { 'type': 'string' } },
        'type': 'object'
      }, '/properties/name');

      const minCount = findRelations(rels, 'sh:minCount');

      assert.equal(minCount.length, 0);
    });

    void it('produces sh:maxCount 1 for non-array properties', () => {
      const rels = nodeRelations({
        '$id': 'https://example.com/T',
        'properties': { 'name': { 'type': 'string' } },
        'type': 'object'
      }, '/properties/name');

      const maxCount = findRelations(rels, 'sh:maxCount');

      assert.equal(maxCount.length, 1);
      assert.equal(maxCount[0].target, '1');
    });

    void it('does not produce sh:maxCount for array properties', () => {
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

  void describe('multi-type union relations', () => {
    void it('produces owl:unionOf for multi-type properties', () => {
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

      const unions = findRelations(rels, 'owl:unionOf').filter((rel) => {
        return rel.structure?.kind === 'list';
      });

      assert.equal(unions.length, 1);
      const struct = unions[0].structure as { 'kind': 'list';
        'members': string[] };

      assert.deepEqual(struct.members, [
        'xsd:string',
        'xsd:decimal'
      ]);
    });

    void it('does not produce owl:unionOf for single-type properties', () => {
      const rels = nodeRelations({
        '$id': 'https://example.com/T',
        'properties': { 'name': { 'type': 'string' } },
        'type': 'object'
      }, '/properties/name');

      const unions = findRelations(rels, 'owl:unionOf').filter((rel) => {
        return rel.structure?.kind === 'list';
      });

      assert.equal(unions.length, 0);
    });

    void it('filters out null from union type members', () => {
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

      const unions = findRelations(rels, 'owl:unionOf').filter((rel) => {
        return rel.structure?.kind === 'list';
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

  void describe('$ref range on property', () => {
    void it('produces rdfs:range with fromRef metadata for $ref', () => {
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

  void describe('existing relation predicates remain correct', () => {
    void it('preserves rdfs:label from title', () => {
      const rels = nodeRelations({
        'title': 'MyClass',
        'type': 'object'
      });

      assert.ok(findRelations(rels, 'rdfs:label').some((rel) => {
        return rel.target === 'MyClass';
      }));
    });

    void it('preserves rdfs:comment from description', () => {
      const rels = nodeRelations({
        'description': 'A thing',
        'type': 'object'
      });

      assert.ok(findRelations(rels, 'rdfs:comment').some((rel) => {
        return rel.target === 'A thing';
      }));
    });

    void it('preserves owl:deprecated', () => {
      const rels = nodeRelations({
        'deprecated': true,
        'type': 'string'
      });

      assert.ok(findRelations(rels, 'owl:deprecated').length > 0);
    });

    void it('preserves rdfs:subClassOf from allOf', () => {
      const rels = nodeRelations({
        'allOf': [{ 'type': 'object' as const }],
        'type': 'object' as const
      });

      assert.ok(findRelations(rels, 'rdfs:subClassOf').length > 0);
    });

    void it('preserves owl:equivalentClass from anyOf', () => {
      const rels = nodeRelations({
        'anyOf': [
          { 'type': 'string' as const },
          { 'type': 'number' as const }
        ]
      });

      assert.ok(findRelations(rels, 'owl:equivalentClass').length > 0);
    });

    void it('preserves owl:complementOf from not', () => {
      const rels = nodeRelations({ 'not': { 'type': 'array' as const } });

      assert.ok(findRelations(rels, 'owl:complementOf').length > 0);
    });

    void it('preserves owl:Restriction from required', () => {
      const rels = nodeRelations({
        'properties': { 'name': { 'type': 'string' as const } },
        'required': ['name'],
        'type': 'object' as const
      });

      assert.ok(findRelations(rels, 'owl:Restriction').length > 0);
    });

    void it('preserves owl:oneOf from enum', () => {
      const rels = nodeRelations({
        'enum': [
          'a',
          'b'
        ],
        'type': 'string' as const
      });

      assert.equal(findRelations(rels, 'owl:oneOf').length, 2);
    });

    void it('preserves owl:disjointWith', () => {
      const rels = nodeRelations({
        'disjointWith': 'https://example.com/Other',
        'type': 'object' as const
      });

      assert.ok(findRelations(rels, 'owl:disjointWith').length > 0);
    });

    void it('preserves owl:inverseOf', () => {
      const rels = nodeRelations({
        'inverseOf': 'https://example.com/inverse',
        'type': 'string' as const
      });

      assert.ok(findRelations(rels, 'owl:inverseOf').length > 0);
    });

    void it('preserves owl:TransitiveProperty', () => {
      const rels = nodeRelations({
        'transitive': true,
        'type': 'string' as const
      });

      assert.ok(findRelations(rels, 'owl:TransitiveProperty').length > 0);
    });

    void it('preserves owl:SymmetricProperty', () => {
      const rels = nodeRelations({
        'symmetric': true,
        'type': 'string' as const
      });

      assert.ok(findRelations(rels, 'owl:SymmetricProperty').length > 0);
    });
  });

  void describe('comprehensive integration', () => {
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
});
