import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { SchemaGraph } from '../../src/modules/graph/SchemaGraph.js';

describe('Graph conformance', () => {
  describe('semantics completeness', () => {
    it('exposes all validation-relevant fields from graph semantics', () => {
      const schema = {
        '$id': 'https://example.com/Person',
        'additionalProperties': false,
        'properties': {
          'age': {
            'minimum': 0,
            'type': 'integer'
          },
          'email': {
            'format': 'email',
            'type': 'string'
          },
          'name': {
            'minLength': 1,
            'type': 'string'
          },
          'tags': {
            'items': { 'type': 'string' },
            'minItems': 1,
            'type': 'array'
          }
        },
        'required': [
          'name',
          'age'
        ],
        'type': 'object'
      } as const;

      const graph = new SchemaGraph(schema);
      const root = graph.rootNode;
      const sem = graph.semantics(root);

      assert.deepEqual(sem.schemaTypes, ['object']);
      assert.deepEqual(sem.required, [
        'name',
        'age'
      ]);
      assert.equal(sem.properties.size, 4);

      const nameNode = sem.properties.get('name')!;
      const nameSem = graph.semantics(nameNode);

      assert.deepEqual(nameSem.schemaTypes, ['string']);
      assert.equal(nameSem.minLength, 1);

      const ageNode = sem.properties.get('age')!;
      const ageSem = graph.semantics(ageNode);

      assert.deepEqual(ageSem.schemaTypes, ['integer']);
      assert.equal(ageSem.minimum, 0);

      const emailNode = sem.properties.get('email')!;
      const emailSem = graph.semantics(emailNode);

      assert.equal(emailSem.format, 'email');

      const tagsNode = sem.properties.get('tags')!;
      const tagsSem = graph.semantics(tagsNode);

      assert.deepEqual(tagsSem.schemaTypes, ['array']);
      assert.equal(tagsSem.minItems, 1);
      assert.ok(tagsSem.itemsNode !== undefined);
      assert.deepEqual(graph.semantics(tagsSem.itemsNode).schemaTypes, ['string']);

      assert.equal(sem.additionalPropertiesNode, false);
    });

    it('exposes numeric constraints through semantics', () => {
      const schema = {
        'exclusiveMaximum': 101,
        'exclusiveMinimum': -1,
        'maximum': 100,
        'minimum': 0,
        'multipleOf': 5,
        'type': 'number'
      } as const;

      const graph = new SchemaGraph(schema);
      const sem = graph.semantics(graph.rootNode);

      assert.equal(sem.minimum, 0);
      assert.equal(sem.maximum, 100);
      assert.equal(sem.exclusiveMinimum, -1);
      assert.equal(sem.exclusiveMaximum, 101);
      assert.equal(sem.multipleOf, 5);
    });

    it('exposes string constraints through semantics', () => {
      const schema = {
        'maxLength': 50,
        'minLength': 2,
        'pattern': '^[a-z]+$',
        'type': 'string'
      } as const;

      const graph = new SchemaGraph(schema);
      const sem = graph.semantics(graph.rootNode);

      assert.equal(sem.minLength, 2);
      assert.equal(sem.maxLength, 50);
      assert.equal(sem.pattern, '^[a-z]+$');
    });

    it('exposes enum and const through semantics', () => {
      const schema = {
        'enum': [
          'red',
          'green',
          'blue'
        ],
        'type': 'string'
      } as const;

      const graph = new SchemaGraph(schema);
      const sem = graph.semantics(graph.rootNode);

      assert.deepEqual(sem.enumValues, [
        'red',
        'green',
        'blue'
      ]);

      const constSchema = { 'const': 42 } as const;
      const constGraph = new SchemaGraph(constSchema);
      const constSem = constGraph.semantics(constGraph.rootNode);

      assert.equal(constSem.constValue, 42);
      assert.equal(constSem.hasConst, true);
    });

    it('exposes default value through semantics', () => {
      const schema = {
        'default': 'hello',
        'type': 'string'
      } as const;

      const graph = new SchemaGraph(schema);
      const sem = graph.semantics(graph.rootNode);

      assert.equal(sem.defaultValue, 'hello');
      assert.equal(sem.hasDefault, true);
    });

    it('exposes metadata annotations through semantics', () => {
      const schema = {
        'deprecated': true,
        'description': 'A widget thing',
        'readOnly': true,
        'title': 'Widget',
        'type': 'object'
      } as const;

      const graph = new SchemaGraph(schema);
      const sem = graph.semantics(graph.rootNode);

      assert.equal(sem.title, 'Widget');
      assert.equal(sem.description, 'A widget thing');
      assert.equal(sem.deprecated, true);
      assert.equal(sem.readOnly, true);
    });
  });

  describe('graph identity', () => {
    it('nodes with $id use the $id as their id', () => {
      const schema = {
        '$id': 'https://example.com/Foo',
        'type': 'object'
      } as const;
      const graph = new SchemaGraph(schema);

      assert.equal(graph.rootNode.id, 'https://example.com/Foo');
    });

    it('nodes without $id use pointer-based ids', () => {
      const schema = {
        '$id': 'https://example.com/Root',
        'properties': { 'x': { 'type': 'string' } },
        'type': 'object'
      } as const;
      const graph = new SchemaGraph(schema);
      const xNode = graph.semantics(graph.rootNode).properties.get('x')!;

      assert.equal(xNode.id, 'https://example.com/Root#/properties/x');
    });

    it('$defs children get pointer-based ids when no $id', () => {
      const schema = {
        '$defs': { 'Helper': { 'type': 'string' } },
        '$id': 'https://example.com/Base',
        'type': 'object'
      } as const;
      const graph = new SchemaGraph(schema);
      const helperNode = graph.resolvePointer('/$defs/Helper');

      assert.equal(helperNode.id, 'https://example.com/Base#/$defs/Helper');
    });

    it('$defs children with $id use their own $id', () => {
      const schema = {
        '$defs': {
          'Helper': {
            '$id': 'https://example.com/Helper',
            'type': 'string'
          }
        },
        '$id': 'https://example.com/Base',
        'type': 'object'
      } as const;
      const graph = new SchemaGraph(schema);
      const helperNode = graph.resolvePointer('/$defs/Helper');

      assert.equal(helperNode.id, 'https://example.com/Helper');
    });
  });

  describe('anchor resolution', () => {
    it('resolves $anchor through the graph', () => {
      const schema = {
        '$defs': {
          'Foo': {
            '$anchor': 'foo',
            'type': 'string'
          }
        },
        '$id': 'https://example.com/Anchored',
        'type': 'object'
      } as const;
      const graph = new SchemaGraph(schema);
      const resolved = graph.resolveFragment('foo');

      assert.deepEqual(graph.semantics(resolved).schemaTypes, ['string']);
    });

    it('resolves $dynamicAnchor through the graph', () => {
      const schema = {
        '$defs': {
          'Bar': {
            '$dynamicAnchor': 'bar',
            'type': 'number'
          }
        },
        '$id': 'https://example.com/Dynamic',
        'type': 'object'
      } as const;
      const graph = new SchemaGraph(schema);
      const resolved = graph.resolveFragment('bar');

      assert.deepEqual(graph.semantics(resolved).schemaTypes, ['number']);
    });
  });

  describe('composition nodes', () => {
    it('allOf children are graph nodes with semantics', () => {
      const schema = {
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
      } as const;
      const graph = new SchemaGraph(schema);
      const sem = graph.semantics(graph.rootNode);

      assert.equal(sem.allOf.length, 2);
      const first = graph.semantics(sem.allOf[0]);

      assert.deepEqual(first.required, ['a']);
      assert.deepEqual(first.schemaTypes, ['object']);
      const second = graph.semantics(sem.allOf[1]);

      assert.deepEqual(second.required, ['b']);
    });

    it('anyOf children are graph nodes with semantics', () => {
      const schema = {
        'anyOf': [
          { 'type': 'string' },
          { 'type': 'number' }
        ]
      } as const;
      const graph = new SchemaGraph(schema);
      const sem = graph.semantics(graph.rootNode);

      assert.equal(sem.anyOf.length, 2);
      assert.deepEqual(graph.semantics(sem.anyOf[0]).schemaTypes, ['string']);
      assert.deepEqual(graph.semantics(sem.anyOf[1]).schemaTypes, ['number']);
    });

    it('oneOf children are graph nodes with semantics', () => {
      const schema = {
        'oneOf': [
          { 'type': 'string' },
          { 'type': 'integer' }
        ]
      } as const;
      const graph = new SchemaGraph(schema);
      const sem = graph.semantics(graph.rootNode);

      assert.equal(sem.oneOf.length, 2);
      assert.deepEqual(graph.semantics(sem.oneOf[0]).schemaTypes, ['string']);
      assert.deepEqual(graph.semantics(sem.oneOf[1]).schemaTypes, ['integer']);
    });

    it('not child is a graph node with semantics', () => {
      const schema = { 'not': { 'type': 'string' } } as const;
      const graph = new SchemaGraph(schema);
      const sem = graph.semantics(graph.rootNode);

      assert.ok(sem.notNode !== undefined);
      assert.deepEqual(graph.semantics(sem.notNode).schemaTypes, ['string']);
    });

    it('if/then/else children are graph nodes', () => {
      const schema = {
        'else': { 'type': 'number' },
        'if': { 'type': 'string' },
        'then': { 'minLength': 1 }
      } as const;
      const graph = new SchemaGraph(schema);
      const sem = graph.semantics(graph.rootNode);

      assert.ok(sem.ifNode !== undefined);
      assert.ok(sem.thenNode !== undefined);
      assert.ok(sem.elseNode !== undefined);
      assert.deepEqual(graph.semantics(sem.ifNode).schemaTypes, ['string']);
      assert.equal(graph.semantics(sem.thenNode).minLength, 1);
      assert.deepEqual(graph.semantics(sem.elseNode).schemaTypes, ['number']);
    });
  });

  describe('relations', () => {
    it('produces rdfs:subClassOf for allOf with refs', () => {
      const schema = {
        '$id': 'https://example.com/Child',
        'allOf': [{ '$ref': 'https://example.com/Parent' }]
      } as const;
      const graph = new SchemaGraph(schema);
      const rels = graph.relations(graph.rootNode);
      const subClass = rels.find((r) => {
        return r.predicate === 'rdfs:subClassOf';
      });

      assert.ok(subClass);
      assert.equal(subClass.target, 'https://example.com/Parent');
    });

    it('produces owl:Restriction for required properties', () => {
      const schema = {
        '$id': 'https://example.com/WithReq',
        'properties': { 'x': { 'type': 'string' } },
        'required': ['x'],
        'type': 'object'
      } as const;
      const graph = new SchemaGraph(schema);
      const rels = graph.relations(graph.rootNode);
      const restriction = rels.find((r) => {
        return r.predicate === 'owl:Restriction';
      });

      assert.ok(restriction);
      assert.deepEqual(restriction.metadata, {
        'minCardinality': 1,
        'onProperty': 'https://example.com/WithReq#x'
      });
    });

    it('produces owl:equivalentClass for anyOf members', () => {
      const schema = {
        '$id': 'https://example.com/Union',
        'anyOf': [
          { 'type': 'string' },
          { 'type': 'number' }
        ]
      } as const;
      const graph = new SchemaGraph(schema);
      const rels = graph.relations(graph.rootNode);
      const equivRels = rels.filter((r) => {
        return r.predicate === 'owl:equivalentClass';
      });

      assert.equal(equivRels.length, 2);
    });

    it('produces owl:complementOf for not', () => {
      const schema = {
        '$id': 'https://example.com/Negated',
        'not': { 'type': 'string' }
      } as const;
      const graph = new SchemaGraph(schema);
      const rels = graph.relations(graph.rootNode);
      const complement = rels.find((r) => {
        return r.predicate === 'owl:complementOf';
      });

      assert.ok(complement);
    });

    it('produces owl:oneOf for enum values', () => {
      const schema = {
        '$id': 'https://example.com/Color',
        'enum': [
          'red',
          'green',
          'blue'
        ],
        'type': 'string'
      } as const;
      const graph = new SchemaGraph(schema);
      const rels = graph.relations(graph.rootNode);
      const oneOfRels = rels.filter((r) => {
        return r.predicate === 'owl:oneOf';
      });

      assert.equal(oneOfRels.length, 3);
      assert.equal(oneOfRels[0].target, 'red');
      assert.equal(oneOfRels[1].target, 'green');
      assert.equal(oneOfRels[2].target, 'blue');
    });

    it('produces rdfs:label and rdfs:comment from title and description', () => {
      const schema = {
        '$id': 'https://example.com/Labeled',
        'description': 'A labeled schema',
        'title': 'Labeled',
        'type': 'object'
      } as const;
      const graph = new SchemaGraph(schema);
      const rels = graph.relations(graph.rootNode);
      const label = rels.find((r) => {
        return r.predicate === 'rdfs:label';
      });

      assert.ok(label);
      assert.equal(label.target, 'Labeled');
      const comment = rels.find((r) => {
        return r.predicate === 'rdfs:comment';
      });

      assert.ok(comment);
      assert.equal(comment.target, 'A labeled schema');
    });

    it('produces owl:deprecated for deprecated schemas', () => {
      const schema = {
        '$id': 'https://example.com/Old',
        'deprecated': true,
        'type': 'object'
      } as const;
      const graph = new SchemaGraph(schema);
      const rels = graph.relations(graph.rootNode);
      const dep = rels.find((r) => {
        return r.predicate === 'owl:deprecated';
      });

      assert.ok(dep);
      assert.equal(dep.target, 'true');
    });
  });

  describe('semantics consistency', () => {
    it('produces consistent semantics for equivalent schemas', () => {
      const schema1 = {
        'properties': { 'name': { 'type': 'string' } },
        'required': ['name'],
        'type': 'object'
      } as const;

      const schema2 = {
        'properties': { 'name': { 'type': 'string' } },
        'required': ['name'],
        'type': 'object'
      } as const;

      const graph1 = new SchemaGraph(schema1);
      const graph2 = new SchemaGraph(schema2);
      const sem1 = graph1.semantics(graph1.rootNode);
      const sem2 = graph2.semantics(graph2.rootNode);

      assert.deepEqual(sem1.schemaTypes, sem2.schemaTypes);
      assert.deepEqual(sem1.required, sem2.required);
      assert.equal(sem1.properties.size, sem2.properties.size);
      assert.deepEqual([...sem1.properties.keys()], [...sem2.properties.keys()]);
    });

    it('caches semantics on repeated access', () => {
      const schema = { 'type': 'string' } as const;
      const graph = new SchemaGraph(schema);
      const sem1 = graph.semantics(graph.rootNode);
      const sem2 = graph.semantics(graph.rootNode);

      assert.equal(sem1, sem2);
    });
  });
});
