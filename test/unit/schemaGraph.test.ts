import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { SchemaGraph } from '../../src/modules/graph/schemaGraph.js';

function setSchemaKey(target: Record<string, unknown>, key: string, value: unknown): Record<string, unknown> {
  Reflect.set(target, key, value);

  return target;
}

const thenKeyword: string = String.fromCodePoint(116, 104, 101, 110);

function setThenKeyword(target: Record<string, unknown>, value: unknown): Record<string, unknown> {
  setSchemaKey(target, thenKeyword, value);

  return target;
}

void describe('SchemaGraph', () => {
  void it('lowers pointer-addressable schema nodes', () => {
    const schema = {
      '$defs': {
        'address': {
          'properties': { 'street/name': { 'type': 'string' } },
          'type': 'object'
        }
      },
      'properties': { 'address': { '$ref': '#/$defs/address' } },
      'type': 'object'
    } as const;
    const graph = new SchemaGraph(schema);

    assert.equal(graph.rootNode.pointer, '');
    assert.deepEqual(
      graph.resolvePointer('/$defs/address').schema,
      schema.$defs.address
    );
    assert.deepEqual(
      graph.resolvePointer('/$defs/address/properties/street~1name').schema,
      schema.$defs.address.properties['street/name']
    );
  });

  void it('indexes anchors and dynamic anchors as graph nodes', () => {
    const schema = {
      '$defs': {
        'anchored': {
          '$anchor': 'named',
          '$dynamicAnchor': 'dynamicNamed',
          'type': 'string'
        }
      },
      'type': 'object'
    } as const;
    const graph = new SchemaGraph(schema);

    assert.equal(graph.resolveFragment('named').pointer, '/$defs/anchored');
    assert.equal(graph.resolveFragment('dynamicNamed').pointer, '/$defs/anchored');
  });

  void it('exposes graph relationships for object, array, and composition keywords', () => {
    const base: Record<string, unknown> = {
      'allOf': [{
        'properties': { 'name': { 'type': 'string' } },
        'type': 'object'
      }],
      'contains': { 'type': 'number' },
      'if': {
        'properties': { 'kind': { 'const': 'person' } },
        'type': 'object'
      },
      'prefixItems': [{ 'type': 'string' }],
      'properties': { 'age': { 'type': 'number' } },
      'type': 'object',
      'unevaluatedProperties': false
    };

    setThenKeyword(base, {
      'properties': { 'name': { 'type': 'string' } },
      'type': 'object'
    });
    const graph = new SchemaGraph(base);
    const root = graph.rootNode;

    assert.equal(graph.entries(root, 'properties')[0]?.[0], 'age');
    assert.equal(graph.entries(root, 'properties')[0]?.[1].pointer, '/properties/age');
    assert.equal(graph.indexedChildren(root, 'prefixItems')[0]?.pointer, '/prefixItems/0');
    assert.equal(graph.indexedChildren(root, 'allOf')[0]?.pointer, '/allOf/0');
    assert.equal(graph.child(root, 'contains')?.pointer, '/contains');
    assert.equal(graph.child(root, 'if')?.pointer, '/if');
    assert.equal(graph.child(root, 'then')?.pointer, '/then');
    assert.equal(graph.child(root, 'unevaluatedProperties')?.pointer, '/unevaluatedProperties');
  });

  void it('exposes keyword values through graph semantics', () => {
    const schema = {
      'default': { 'name': 'guest' },
      'maxProperties': 3,
      'required': ['name'],
      'type': 'object'
    } as const;
    const graph = new SchemaGraph(schema);
    const root = graph.rootNode;
    const sem = graph.semantics(root);

    assert.deepEqual(sem.schemaTypes, ['object']);
    assert.equal(sem.maxProperties, 3);
    assert.deepEqual(sem.required, ['name']);
    assert.deepEqual(sem.defaultValue, { 'name': 'guest' });
  });

  void it('reuses cached relationship lookups for graph nodes', () => {
    const schema = {
      'allOf': [{
        'properties': { 'name': { 'type': 'string' } },
        'type': 'object'
      }],
      'properties': { 'age': { 'type': 'number' } },
      'type': 'object'
    } as const;
    const graph = new SchemaGraph(schema);
    const root = graph.rootNode;

    assert.equal(graph.child(root, 'properties'), graph.child(root, 'properties'));
    assert.equal(graph.entries(root, 'properties'), graph.entries(root, 'properties'));
    assert.equal(graph.indexedChildren(root, 'allOf'), graph.indexedChildren(root, 'allOf'));
  });

  void it('exposes cached semantic metadata for execution and ontology consumers', () => {
    const schema = {
      '$defs': {
        'Address': {
          '$dynamicAnchor': 'addressNode',
          'properties': { 'street': { 'type': 'string' } },
          'required': ['street'],
          'type': 'object'
        }
      },
      '$id': 'https://example.io/root',
      'dependentRequired': { 'name': ['address'] },
      'dependentSchemas': {
        'address': {
          'properties': { 'kind': { 'const': 'home' } },
          'type': 'object'
        }
      },
      'properties': {
        'address': { '$ref': '#/$defs/Address' },
        'name': { 'type': 'string' }
      },
      'required': ['name'],
      'type': 'object'
    } as const;
    const graph = new SchemaGraph(schema);
    const root = graph.rootNode;
    const rootSemantics = graph.semantics(root);
    const addressSemantics = graph.semantics(graph.resolvePointer('/$defs/Address'));

    assert.equal(graph.semantics(root), rootSemantics);
    assert.deepEqual(rootSemantics.required, ['name']);
    assert.deepEqual(rootSemantics.schemaTypes, ['object']);
    assert.ok(rootSemantics.properties.has('address'));
    assert.ok(rootSemantics.properties.has('name'));
    const addressPropNode = rootSemantics.properties.get('address');

    assert.ok(addressPropNode !== undefined);
    assert.equal(addressPropNode.pointer, '/properties/address');
    assert.equal(addressPropNode.schema.$ref, '#/$defs/Address');
    assert.deepEqual(rootSemantics.dependentRequired, { 'name': ['address'] });
    assert.equal(rootSemantics.dependentSchemaEntries[0]?.[0], 'address');
    assert.equal(rootSemantics.dependentSchemaEntries[0]?.[1].pointer, '/dependentSchemas/address');
    assert.equal(addressSemantics.dynamicAnchor, 'addressNode');
    assert.deepEqual(addressSemantics.required, ['street']);
    assert.equal(graph.semantics(addressPropNode).refTargetNode?.id, 'https://example.io/root#/$defs/Address');
  });

  void it('populates constraint metadata fields from schema keywords', () => {
    const schema = {
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
    } as const;
    const graph = new SchemaGraph(schema);
    const rootSem = graph.semantics(graph.rootNode);

    assert.equal(rootSem.title, 'A Person');
    assert.equal(rootSem.description, 'Represents a person');
    assert.equal(rootSem.minProperties, 1);
    assert.equal(rootSem.maxProperties, 10);
    assert.equal(rootSem.complementNode?.pointer, '/not');
    assert.equal(typeof rootSem.additionalPropertiesNode, 'object');
    assert.equal((rootSem.additionalPropertiesNode as { 'pointer': string }).pointer, '/additionalProperties');

    const nameNode = rootSem.properties.get('name');

    assert.ok(nameNode !== undefined);
    const nameSem = graph.semantics(nameNode);

    assert.equal(nameSem.minLength, 1);
    assert.equal(nameSem.maxLength, 100);
    assert.equal(nameSem.pattern, '^[A-Z]');
    assert.equal(nameSem.defaultValue, 'Anonymous');
    assert.equal(nameSem.hasDefault, true);
    assert.equal(nameSem.format, 'custom-name');
    assert.equal(nameSem.readOnly, true);
    assert.equal(nameSem.writeOnly, false);

    const ageNode = rootSem.properties.get('age');

    assert.ok(ageNode !== undefined);
    const ageSem = graph.semantics(ageNode);

    assert.equal(ageSem.minimum, 0);
    assert.equal(ageSem.maximum, 150);
    assert.equal(ageSem.exclusiveMinimum, -1);
    assert.equal(ageSem.exclusiveMaximum, 200);
    assert.equal(ageSem.multipleOf, 1);

    const tagsNode = rootSem.properties.get('tags');

    assert.ok(tagsNode !== undefined);
    const tagsSem = graph.semantics(tagsNode);

    assert.equal(tagsSem.minItems, 1);
    assert.equal(tagsSem.maxItems, 10);
    assert.equal(tagsSem.uniqueItems, true);

    const statusNode = rootSem.properties.get('status');

    assert.ok(statusNode !== undefined);
    const statusSem = graph.semantics(statusNode);

    assert.deepEqual(statusSem.enumValues, [
      'active',
      'inactive'
    ]);
    assert.equal(statusSem.constValue, 'active');
    assert.equal(statusSem.hasConst, true);
    assert.equal(statusSem.deprecated, true);
    assert.equal(statusSem.writeOnly, true);

    const bioNode = rootSem.properties.get('bio');

    assert.ok(bioNode !== undefined);
    const bioSem = graph.semantics(bioNode);

    assert.equal(bioSem.contentEncoding, 'base64');
    assert.equal(bioSem.contentMediaType, 'text/plain');
  });

  void it('uses default values for constraint fields on boolean schemas', () => {
    const graph = new SchemaGraph(true);
    const sem = graph.semantics(graph.rootNode);

    assert.equal(sem.title, undefined);
    assert.equal(sem.description, undefined);
    assert.equal(sem.format, undefined);
    assert.equal(sem.defaultValue, undefined);
    assert.equal(sem.hasDefault, false);
    assert.equal(sem.constValue, undefined);
    assert.equal(sem.hasConst, false);
    assert.equal(sem.enumValues, undefined);
    assert.equal(sem.minimum, undefined);
    assert.equal(sem.maximum, undefined);
    assert.equal(sem.uniqueItems, false);
    assert.equal(sem.additionalPropertiesNode, undefined);
    assert.equal(sem.notNode, undefined);
    assert.equal(sem.readOnly, false);
    assert.equal(sem.writeOnly, false);
    assert.equal(sem.deprecated, false);
  });

  void it('handles additionalProperties as boolean false', () => {
    const schema = {
      'additionalProperties': false,
      'type': 'object'
    } as const;
    const graph = new SchemaGraph(schema);
    const sem = graph.semantics(graph.rootNode);

    assert.equal(sem.additionalPropertiesNode, false);
  });

  void it('resolves local refs through canonical graph semantics', () => {
    const schema = {
      '$defs': {
        'Address': {
          '$anchor': 'address',
          'type': 'object'
        }
      },
      '$id': 'https://example.io/root',
      'properties': {
        'byAnchor': { '$ref': '#address' },
        'byPointer': { '$ref': '#/$defs/Address' },
        'self': { '$ref': '#' }
      },
      'type': 'object'
    } as const;
    const graph = new SchemaGraph(schema);
    const rootSemantics = graph.semantics(graph.rootNode);
    const byAnchorNode = rootSemantics.properties.get('byAnchor');

    assert.ok(byAnchorNode !== undefined);
    const byPointerNode = rootSemantics.properties.get('byPointer');

    assert.ok(byPointerNode !== undefined);
    const selfNode = rootSemantics.properties.get('self');

    assert.ok(selfNode !== undefined);
    const byAnchor = graph.semantics(byAnchorNode);
    const byPointer = graph.semantics(byPointerNode);
    const self = graph.semantics(selfNode);

    assert.equal(byAnchor.refTargetNode?.id, 'https://example.io/root#/$defs/Address');
    assert.equal(byPointer.refTargetNode?.id, 'https://example.io/root#/$defs/Address');
    assert.equal(self.refTargetNode?.id, 'https://example.io/root');
  });

  void it('produces correct OWL/RDFS relations from schema keywords', () => {
    const scenarios: Array<{ 'count': number;
      'predicate': string;
      'schema': Record<string, unknown>;
      'target'?: unknown }> = [
      {
        'count': 2,
        'predicate': 'rdfs:subClassOf',
        'schema': {
          'allOf': [
            { 'type': 'object' },
            { 'type': 'object' }
          ],
          'type': 'object'
        }
      },
      {
        'count': 2,
        'predicate': 'owl:equivalentClass',
        'schema': {
          'anyOf': [
            { 'type': 'string' },
            { 'type': 'number' }
          ]
        }
      },
      {
        'count': 1,
        'predicate': 'owl:complementOf',
        'schema': { 'not': { 'type': 'array' } }
      },
      {
        'count': 2,
        'predicate': 'owl:oneOf',
        'schema': {
          'enum': [
            'active',
            'inactive'
          ],
          'type': 'string'
        }
      },
      {
        'count': 1,
        'predicate': 'rdfs:label',
        'schema': {
          'title': 'Person',
          'type': 'object'
        },
        'target': 'Person'
      },
      {
        'count': 1,
        'predicate': 'rdfs:comment',
        'schema': {
          'description': 'A person',
          'type': 'object'
        },
        'target': 'A person'
      },
      {
        'count': 1,
        'predicate': 'owl:deprecated',
        'schema': {
          'deprecated': true,
          'type': 'string'
        }
      },
      {
        'count': 1,
        'predicate': 'owl:disjointWith',
        'schema': {
          'disjointWith': 'https://example.com/Cat',
          'type': 'object'
        },
        'target': 'https://example.com/Cat'
      },
      {
        'count': 1,
        'predicate': 'owl:equivalentClass',
        'schema': {
          'equivalentTo': 'https://example.com/Human',
          'type': 'object'
        },
        'target': 'https://example.com/Human'
      }
    ];

    for (const {
      count, predicate, schema, target
    } of scenarios) {
      const graph = new SchemaGraph(schema);
      const rels = graph.relations(graph.rootNode).filter((rel) => {
        return rel.predicate === predicate;
      });

      assert.equal(rels.length, count);
      if (target !== undefined) {
        assert.equal(rels[0].target, target);
      }
    }
  });

  void it('produces restriction, domain/range, and allRelations', () => {
    // Required → owl:Restriction with metadata
    const reqSchema = {
      'properties': {
        'age': { 'type': 'number' as const },
        'name': { 'type': 'string' as const }
      },
      'required': [
        'name',
        'age'
      ],
      'type': 'object' as const
    };
    const reqGraph = new SchemaGraph(reqSchema);
    const restrictions = reqGraph.relations(reqGraph.rootNode).filter((rel) => {
      return rel.predicate === 'owl:Restriction';
    });

    assert.equal(restrictions.length, 2);
    assert.equal((restrictions[0].metadata as Record<string, unknown>).minCardinality, 1);

    // rdfs:domain and rdfs:range
    const drSchema = {
      'rdfs:domain': 'https://example.com/Person',
      'rdfs:range': 'http://www.w3.org/2001/XMLSchema#string',
      'type': 'string'
    };
    const drGraph = new SchemaGraph(drSchema);
    const drRels = drGraph.relations(drGraph.rootNode);

    assert.equal(drRels.filter((rel) => {
      return rel.predicate === 'rdfs:domain';
    }).length, 1);
    assert.equal(drRels.filter((rel) => {
      return rel.predicate === 'rdfs:range';
    }).length, 1);

    // allRelations aggregates across all nodes
    const allSchema = {
      'properties': {
        'status': {
          'enum': [
            'on',
            'off'
          ],
          'type': 'string' as const
        }
      },
      'required': ['status'],
      'type': 'object' as const
    };
    const allGraph = new SchemaGraph(allSchema);
    const all = allGraph.allRelations();

    assert.ok(all.length >= 3);
    assert.ok(all.some((rel) => {
      return rel.predicate === 'owl:Restriction';
    }));
    assert.ok(all.some((rel) => {
      return rel.predicate === 'owl:oneOf';
    }));
  });

  void it('produces property-level OWL relations', () => {
    const scenarios: Array<{ 'predicate': string;
      'prop': string;
      'schema': Record<string, unknown>;
      'target'?: string }> = [
      {
        'predicate': 'owl:inverseOf',
        'prop': 'owns',
        'schema': {
          'properties': {
            'owns': {
              'inverseOf': 'https://example.com/Thing#ownedBy',
              'type': 'string'
            }
          },
          'type': 'object'
        },
        'target': 'https://example.com/Thing#ownedBy'
      },
      {
        'predicate': 'owl:TransitiveProperty',
        'prop': 'ancestor',
        'schema': {
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
        'predicate': 'owl:SymmetricProperty',
        'prop': 'sibling',
        'schema': {
          'properties': {
            'sibling': {
              'symmetric': true,
              'type': 'string'
            }
          },
          'type': 'object'
        }
      }
    ];

    for (const {
      predicate, prop, schema, target
    } of scenarios) {
      const graph = new SchemaGraph(schema);
      const propNode = graph.resolvePointer(`/properties/${prop}`);
      const rels = graph.relations(propNode).filter((rel) => {
        return rel.predicate === predicate;
      });

      assert.ok(rels.length > 0);
      if (target !== undefined) {
        assert.equal(rels[0].target, target);
      }
    }
  });

  // ---------------------------------------------------------------------------
  // Graph identity and composition (merged from graphConformance.test.ts)
  // ---------------------------------------------------------------------------

  void it('assigns correct node ids based on $id and pointer', () => {
    // $id becomes the id
    const s1 = {
      '$id': 'https://example.com/Foo',
      'type': 'object'
    } as const;

    assert.equal(new SchemaGraph(s1).rootNode.id, 'https://example.com/Foo');

    // Pointer-based ids for children
    const s2 = {
      '$id': 'https://example.com/Root',
      'properties': { 'x': { 'type': 'string' } },
      'type': 'object'
    } as const;
    const g2 = new SchemaGraph(s2);

    assert.equal(g2.semantics(g2.rootNode).properties.get('x')?.id, 'https://example.com/Root#/properties/x');

    // $defs without $id → pointer-based
    const s3 = {
      '$defs': { 'Helper': { 'type': 'string' } },
      '$id': 'https://example.com/Base',
      'type': 'object'
    } as const;

    assert.equal(new SchemaGraph(s3).resolvePointer('/$defs/Helper').id, 'https://example.com/Base#/$defs/Helper');

    // $defs with $id → use own $id
    const s4 = {
      '$defs': {
        'Helper': {
          '$id': 'https://example.com/Helper',
          'type': 'string'
        }
      },
      '$id': 'https://example.com/Base',
      'type': 'object'
    } as const;

    assert.equal(new SchemaGraph(s4).resolvePointer('/$defs/Helper').id, 'https://example.com/Helper');
  });

  void it('exposes oneOf, if/then/else composition, and semantic consistency', () => {
    // oneOf children have semantics
    const oneOfSchema = {
      'oneOf': [
        { 'type': 'string' },
        { 'type': 'integer' }
      ]
    } as const;
    const oneOfGraph = new SchemaGraph(oneOfSchema);
    const oneOfSem = oneOfGraph.semantics(oneOfGraph.rootNode);

    assert.equal(oneOfSem.oneOf.length, 2);
    assert.deepEqual(oneOfGraph.semantics(oneOfSem.oneOf[0]).schemaTypes, ['string']);
    assert.deepEqual(oneOfGraph.semantics(oneOfSem.oneOf[1]).schemaTypes, ['integer']);

    // if/then/else children are graph nodes
    const iteSchema = JSON.parse('{"if":{"type":"string"},"then":{"minLength":1},"else":{"type":"number"}}') as Record<string, unknown>;
    const iteGraph = new SchemaGraph(iteSchema);
    const iteSem = iteGraph.semantics(iteGraph.rootNode);

    assert.ok(iteSem.ifNode !== undefined);
    assert.ok(iteSem.thenNode !== undefined);
    assert.ok(iteSem.elseNode !== undefined);
    assert.deepEqual(iteGraph.semantics(iteSem.ifNode).schemaTypes, ['string']);
    assert.equal(iteGraph.semantics(iteSem.thenNode).minLength, 1);
    assert.deepEqual(iteGraph.semantics(iteSem.elseNode).schemaTypes, ['number']);

    // Equivalent schemas produce consistent semantics
    const sa = {
      'properties': { 'name': { 'type': 'string' } },
      'required': ['name'],
      'type': 'object'
    } as const;
    const sb = {
      'properties': { 'name': { 'type': 'string' } },
      'required': ['name'],
      'type': 'object'
    } as const;
    const ga = new SchemaGraph(sa);
    const gb = new SchemaGraph(sb);

    assert.deepEqual(ga.semantics(ga.rootNode).schemaTypes, gb.semantics(gb.rootNode).schemaTypes);
    assert.deepEqual(ga.semantics(ga.rootNode).required, gb.semantics(gb.rootNode).required);
    assert.equal(ga.semantics(ga.rootNode).properties.size, gb.semantics(gb.rootNode).properties.size);
  });
});
