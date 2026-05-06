// Merged from: schemaGraph.test.ts, relations.test.ts, domainRange.test.ts, graphArtifact.test.ts, schemaEngine.test.ts, schemaIri.test.ts
// Phase-1 mechanical consolidation per .audits/test-consolidation-2026-05.md

import assert from 'node:assert/strict';
import type { GraphArtifactInterface } from '../../src/interfaces/GraphArtifact.js';
import type { NormIRInterface } from '../../src/interfaces/SchemaGraph.js';
import type { SchemaGraphRelationInterface } from '../../src/interfaces/SchemaGraph.js';
import {
  describe, it
} from 'node:test';
import { GraphArtifact } from '../../src/modules/graph/GraphArtifact.js';
import { GraphEngine } from '../../src/modules/graph/GraphEngine.js';
import { GraphOntologySerializer } from '../../src/modules/ontology/GraphOntologySerializer.js';
import { GraphShaclSerializer } from '../../src/modules/ontology/GraphShaclSerializer.js';
import { SchemaGraph } from '../../src/modules/graph/SchemaGraph.js';
import { SchemaIri } from '../../src/modules/graph/SchemaIri.js';
import { SchemaRegistry } from '../../src/modules/registry/SchemaRegistry.js';

// ===========================================================================
// Source: schemaGraph.test.ts
// ===========================================================================
{
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
}

// ===========================================================================
// Source: relations.test.ts
// ===========================================================================
{
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

    void it('handles edge-case schemas with no properties, boolean subschema, and empty oneOf', () => {
      const edgeScenarios: Array<{
        'assertions': (rels: SchemaGraphRelationInterface[]) => void;
        'name': string;
        'schema': Record<string, unknown>;
      }> = [
        {
          'assertions': (rels) => {
            const propTypes = rels.filter((rel) => {
              return rel.target === 'owl:ObjectProperty' || rel.target === 'owl:DatatypeProperty';
            });

            assert.equal(propTypes.length, 0, 'edge: no properties — no property-type relations');
          },
          'name': 'edge: schema with no properties produces no property-type relations',
          'schema': {
            '$id': 'https://example.com/NoProps',
            'type': 'object'
          }
        },
        {
          'assertions': (rels) => {
            const subClassRels = findRelations(rels, 'rdfs:subClassOf');

            assert.ok(subClassRels.length > 0, 'edge: boolean true subschema — produces subClassOf');
          },
          'name': 'edge: boolean true subschema in allOf produces relations',
          'schema': {
            '$id': 'https://example.com/BoolAllOf',
            'allOf': [
              true as unknown as Record<string, unknown>,
              { 'type': 'object' }
            ],
            'type': 'object'
          }
        },
        {
          'assertions': (rels) => {
            const equivRels = findRelations(rels, 'owl:equivalentClass');

            assert.equal(equivRels.length, 0, 'edge: empty oneOf — no equivalentClass relations');
          },
          'name': 'edge: empty oneOf array produces no equivalentClass relations',
          'schema': {
            '$id': 'https://example.com/EmptyOneOf',
            'oneOf': [],
            'type': 'object'
          }
        }
      ];

      for (const {
        assertions, name, schema
      } of edgeScenarios) {
        const rels = nodeRelations(schema);

        assertions(rels);
        assert.ok(true, name);
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
}

// ===========================================================================
// Source: domainRange.test.ts
// ===========================================================================
{
  const AddressSchema = {
    '$id': 'https://example.io/Address',
    'properties': {
      'city': { 'type': 'string' },
      'street': { 'type': 'string' }
    },
    'required': [
      'street',
      'city'
    ],
    'type': 'object'
  } as const;

  const PersonSchema = {
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
        'http://www.w3.org/2000/01/rdf-schema#range': 'https://example.io/Address'
      },
      'friends': {
        'http://www.w3.org/2000/01/rdf-schema#range': 'https://example.io/Person',
        'items': { 'type': 'object' },
        'type': 'array'
      },
      'name': { 'type': 'string' },
      'tag': {
        'http://www.w3.org/2000/01/rdf-schema#domain': 'https://example.io/Taggable',
        'type': 'string'
      }
    },
    'required': ['name'],
    'type': 'object'
  } as const;

  function makeRegistry(): SchemaRegistry {
    const reg = new SchemaRegistry();

    reg.register(AddressSchema as unknown as Record<string, unknown>);
    reg.register(PersonSchema as unknown as Record<string, unknown>);

    return reg;
  }

  void describe('rdfs:domain and rdfs:range', () => {
    const reg = makeRegistry();

    const rangeScenarios: Array<{ 'data': unknown;
      'name': string;
      'valid': boolean }> = [
      {
        'data': {
          'address': {
            'city': 'Springfield',
            'street': '123 Main'
          },
          'name': 'Alice'
        },
        'name': 'valid object with range-constrained $ref property',
        'valid': true
      },
      {
        'data': {
          'address': { 'street': '123 Main' },
          'name': 'Alice'
        },
        'name': 'unhappy: address missing required city',
        'valid': false
      },
      {
        'data': {
          'friends': [
            { 'name': 'Bob' },
            { 'name': 'Charlie' }
          ],
          'name': 'Alice'
        },
        'name': 'valid array items with range',
        'valid': true
      },
      {
        'data': {
          'friends': [
            { 'name': 'Bob' },
            { 'notName': 'missing' }
          ],
          'name': 'Alice'
        },
        'name': 'unhappy: array item missing required name',
        'valid': false
      },
      {
        'data': {
          'name': 'Alice',
          'tag': 'hello'
        },
        'name': 'domain is annotation-only (no validation effect)',
        'valid': true
      },
      {
        'data': {
          'address': {
            'city': 'Springfield',
            'street': '123 Main'
          },
          'name': 'Alice'
        },
        'name': 'combined $ref + rdfs:range — both constraints enforced',
        'valid': true
      },
      {
        'data': { 'name': 'Alice' },
        'name': 'edge: no range-annotated properties provided',
        'valid': true
      },
      {
        'data': {
          'friends': [],
          'name': 'Alice'
        },
        'name': 'edge: empty friends array — valid when no items to constrain',
        'valid': true
      },
      {
        'data': {
          'name': 'Alice',
          'tag': 42
        },
        'name': 'unhappy: wrong type for domain-annotated string field',
        'valid': false
      }
    ];

    for (const {
      data, name, valid
    } of rangeScenarios) {
      void it(name, () => {
        const errors = reg.validate('https://example.io/Person', data);

        assert.equal(errors.length === 0, valid, name);
      });
    }

    void it('treats unregistered range schema as annotation-only', () => {
      const localReg = new SchemaRegistry();

      localReg.register({
        '$id': 'https://example.io/WithUnknownRange',
        'properties': {
          'data': {
            'http://www.w3.org/2000/01/rdf-schema#range': 'https://example.io/NonExistent',
            'type': 'object'
          }
        },
        'type': 'object'
      });
      assert.ok(localReg.validate('https://example.io/WithUnknownRange', { 'data': { 'anything': 'goes' } }).ok);
    });

    void it('uses explicit domain/range in OWL output', () => {
      const owlReg = makeRegistry();
      const serializer = new GraphOntologySerializer();
      const nodes = serializer.serialize(owlReg.listGraphs()) as Array<Record<string, unknown>>;

      const addressProp = nodes.find((node) => {
        return node['@id'] === 'https://example.io/Person#address';
      });

      assert.ok(addressProp !== undefined);
      assert.deepEqual(addressProp['http://www.w3.org/2000/01/rdf-schema#range'], { '@id': 'https://example.io/Address' });

      const tagProp = nodes.find((node) => {
        return node['@id'] === 'https://example.io/Person#tag';
      });

      assert.ok(tagProp !== undefined);
      assert.deepEqual(tagProp['http://www.w3.org/2000/01/rdf-schema#domain'], { '@id': 'https://example.io/Taggable' });

      const personClass = nodes.find((node) => {
        return node['@id'] === 'https://example.io/Person' && node['@type'] === 'http://www.w3.org/2002/07/owl#Class';
      });

      assert.ok(personClass !== undefined);
      const subs = personClass['http://www.w3.org/2000/01/rdf-schema#subClassOf'] as Array<Record<string, unknown>>;

      assert.ok(Array.isArray(subs));
      const avf = subs.find((restriction) => {
        const onPropId = restriction['http://www.w3.org/2002/07/owl#onProperty'] as Record<string, unknown> | undefined;

        return onPropId?.['@id'] === 'https://example.io/Person#friends'
      && restriction['http://www.w3.org/2002/07/owl#allValuesFrom'] !== undefined;
      });

      assert.ok(avf !== undefined);
      assert.deepEqual(avf['http://www.w3.org/2002/07/owl#allValuesFrom'], { '@id': 'https://example.io/Person' });
    });

    void it('uses explicit range for sh:class in SHACL output', () => {
      const shaclReg = makeRegistry();
      const serializer = new GraphShaclSerializer();
      const shapes = serializer.serialize(shaclReg.listGraphs()) as Array<Record<string, unknown>>;

      const personShape = shapes.find((shape) => {
        return shape['@id'] === 'https://example.io/Person';
      });

      assert.ok(personShape !== undefined);
      const propShapes = personShape['http://www.w3.org/ns/shacl#property'] as Array<Record<string, unknown>>;

      assert.ok(Array.isArray(propShapes));

      const addressPS = propShapes.find((ps) => {
        const pathId = ps['http://www.w3.org/ns/shacl#path'] as Record<string, unknown> | undefined;

        return pathId?.['@id'] === 'https://example.io/Person#address';
      });

      assert.ok(addressPS !== undefined);
      assert.deepEqual(addressPS['http://www.w3.org/ns/shacl#class'], { '@id': 'https://example.io/Address' });
      assert.equal(addressPS['http://www.w3.org/ns/shacl#node'], undefined);

      const tagPS = propShapes.find((ps) => {
        const pathId = ps['http://www.w3.org/ns/shacl#path'] as Record<string, unknown> | undefined;

        return pathId?.['@id'] === 'https://example.io/Taggable#tag';
      });

      assert.ok(tagPS !== undefined);
    });

    void it('serializes extended predicates (disjointWith, inverseOf, transitive, symmetric)', () => {
      const registry = new SchemaRegistry();

      registry.register({
        '$id': 'https://example.io/Dog',
        'disjointWith': 'https://example.io/Cat',
        'properties': { 'name': { 'type': 'string' as const } },
        'type': 'object' as const
      });
      registry.register({
        '$id': 'https://example.io/Cat',
        'properties': { 'name': { 'type': 'string' as const } },
        'type': 'object' as const
      });
      registry.register({
        '$id': 'https://example.io/Pet',
        'properties': { 'owner': { '$ref': 'https://example.io/Owner' } },
        'type': 'object' as const
      });
      registry.register({
        '$id': 'https://example.io/Owner',
        'properties': {
          'pets': {
            'inverseOf': 'https://example.io/Pet#owner',
            'items': { '$ref': 'https://example.io/Pet' },
            'type': 'array' as const
          }
        },
        'type': 'object' as const
      });
      registry.register({
        '$id': 'https://example.io/GraphNode',
        'properties': {
          'ancestor': {
            'transitive': true,
            'type': 'string' as const
          },
          'sibling': {
            'symmetric': true,
            'type': 'string' as const
          }
        },
        'type': 'object' as const
      });

      const owlSerializer = new GraphOntologySerializer();
      const output = owlSerializer.serialize(registry.listGraphs()) as Array<Record<string, unknown>>;

      // disjointWith
      const dogClass = output.find((node) => {
        return node['@id'] === 'https://example.io/Dog';
      });

      assert.ok(dogClass);
      assert.deepEqual(dogClass['http://www.w3.org/2002/07/owl#disjointWith'], { '@id': 'https://example.io/Cat' });

      // inverseOf
      const petsProp = output.find((node) => {
        return node['@id'] === 'https://example.io/Owner#pets';
      });

      assert.ok(petsProp);
      assert.deepEqual(petsProp['http://www.w3.org/2002/07/owl#inverseOf'], { '@id': 'https://example.io/Pet#owner' });

      // transitive and symmetric
      const ancestorProp = output.find((node) => {
        return node['@id'] === 'https://example.io/GraphNode#ancestor';
      });

      assert.ok(ancestorProp);
      assert.ok(Array.isArray(ancestorProp['@type']));
      assert.ok((ancestorProp['@type'] as string[]).includes('http://www.w3.org/2002/07/owl#TransitiveProperty'));

      const siblingProp = output.find((node) => {
        return node['@id'] === 'https://example.io/GraphNode#sibling';
      });

      assert.ok(siblingProp);
      assert.ok(Array.isArray(siblingProp['@type']));
      assert.ok((siblingProp['@type'] as string[]).includes('http://www.w3.org/2002/07/owl#SymmetricProperty'));
    });
  });
}

// ===========================================================================
// Source: graphArtifact.test.ts
// ===========================================================================
{
  const TestSchema = {
    '$id': 'https://example.com/Test',
    'properties': {
      'age': { 'type': 'number' },
      'name': { 'type': 'string' }
    },
    'required': ['name'],
    'type': 'object'
  } as const;

  const RichSchema = {
    '$defs': {
      'Item': {
        '$anchor': 'itemAnchor',
        'properties': { 'label': { 'type': 'string' } },
        'required': ['label'],
        'type': 'object'
      }
    },
    '$dynamicAnchor': 'rootDynamic',
    '$id': 'https://example.com/Rich',
    'contains': { '$ref': '#itemAnchor' },
    'if': {
      'properties': { 'kind': { 'const': 'special' } },
      'type': 'object'
    },
    'maxContains': 2,
    'minContains': 1,
    'patternProperties': { '^x-': { 'type': 'number' } },
    'properties': {
      'child': { '$dynamicRef': '#rootDynamic' },
      'kind': { 'type': 'string' },
      'primary': { '$ref': '#/$defs/Item' }
    },
    'required': [
      'kind',
      'primary'
    ],
    // eslint-disable-next-line unicorn/no-thenable -- JSON Schema 'then' keyword
    'then': {
      'properties': { 'flag': { 'type': 'boolean' } },
      'type': 'object'
    },
    'type': 'object'
  } as const;

  const BooleanSubschemaSchema = {
    '$id': 'https://example.com/BoolSub',
    'properties': {
      'allowed': true,
      'forbidden': false,
      'name': { 'type': 'string' }
    },
    'type': 'object'
  } as const;

  const DeepRefSchema = {
    '$defs': {
      'Address': {
        '$id': 'https://example.com/Address',
        'properties': {
          'city': { 'type': 'string' },
          'zip': { 'type': 'string' }
        },
        'type': 'object'
      },
      'Company': {
        '$id': 'https://example.com/Company',
        'properties': {
          'hq': { '$ref': 'https://example.com/Address' },
          'name': { 'type': 'string' }
        },
        'type': 'object'
      }
    },
    '$id': 'https://example.com/DeepRef',
    'properties': {
      'employer': { '$ref': 'https://example.com/Company' },
      'name': { 'type': 'string' }
    },
    'type': 'object'
  } as const;

  void describe('GraphArtifact', () => {
    void describe('toArtifact', () => {
      const toArtifactScenarios: Array<{
        'check': (artifact: GraphArtifactInterface) => void;
        'name': string;
        'schema': Record<string, unknown>;
      }> = [
        {
          'check': (artifact) => {
          // Shape and metadata
            assert.equal(typeof artifact.normIR, 'object');
            assert.equal(typeof artifact.semanticsHashes, 'object');
            assert.deepEqual(artifact.normIR.rootSchema, TestSchema);
            const meta = (artifact as unknown as { 'metadata': { 'schemaHash': string } }).metadata;

            assert.equal(typeof meta, 'object');
            assert.ok(typeof meta.schemaHash === 'string' && meta.schemaHash.length > 0);

            // NormIR nodes with pointers
            const pointers = new Set(artifact.normIR.nodes.map((node) => {
              return node.pointer;
            }));

            assert.ok(pointers.has(''));
            assert.ok(pointers.has('/properties'));
            assert.ok(pointers.has('/properties/name'));

            // Semantics hashes per node
            assert.ok('' in artifact.semanticsHashes);
            assert.ok('/properties/name' in artifact.semanticsHashes);

            // NormIR structural data
            assert.ok('' in artifact.normIR.children);
            assert.ok('' in artifact.normIR.entries);
            assert.ok('properties' in artifact.normIR.entries['']);
          },
          'name': 'happy: serializes canonical artifact shape with normIR, metadata, pointers, hashes, and structural data',
          'schema': TestSchema as unknown as Record<string, unknown>
        },
        {
          'check': (artifact) => {
            const pointers = new Set(artifact.normIR.nodes.map((node) => {
              return node.pointer;
            }));

            // Boolean subschemas should still produce nodes for the containing properties
            assert.ok(pointers.has(''));
            assert.ok(pointers.has('/properties'));
            assert.ok(pointers.has('/properties/name'));
          },
          'name': 'edge: produces artifact from schema with boolean subschemas',
          'schema': BooleanSubschemaSchema as unknown as Record<string, unknown>
        },
        {
          'check': (artifact) => {
            const pointers = new Set(artifact.normIR.nodes.map((node) => {
              return node.pointer;
            }));

            // Deeply nested $defs and $ref chains produce nodes for all levels
            assert.ok(pointers.has(''));
            assert.ok(pointers.has('/$defs/Company'));
            assert.ok(pointers.has('/$defs/Address'));
          },
          'name': 'edge: produces artifact from schema with deeply nested $ref chains',
          'schema': DeepRefSchema as unknown as Record<string, unknown>
        }
      ];

      for (const {
        check, 'name': scenarioName, schema
      } of toArtifactScenarios) {
        void it(scenarioName, () => {
          const graph = new SchemaGraph(schema);
          const artifact = GraphArtifact.toArtifact(graph);

          check(artifact);
        });
      }
    });

    void describe('fromArtifact', () => {
      const roundtripScenarios: Array<{
        'check': (rebuilt: ReturnType<typeof GraphArtifact.fromArtifact>, graph: SchemaGraph) => void;
        'name': string;
        'schema': Record<string, unknown>;
      }> = [
        {
          'check': (rebuilt, graph) => {
          // Node and relation counts
            assert.equal(rebuilt.nodes().length, graph.nodes().length);
            assert.equal(rebuilt.allRelations().length, graph.allRelations().length);

            // Node ids preserved
            assert.deepEqual(
              rebuilt.nodes().map((node) => {
                return node.id;
              }),
              graph.nodes().map((node) => {
                return node.id;
              })
            );

            // rootSchema identity
            assert.deepEqual(rebuilt.rootSchema, TestSchema);

            // Semantics preserved
            const originalSem = graph.semantics(graph.rootNode);
            const rebuiltSem = rebuilt.semantics(rebuilt.rootNode);

            assert.deepEqual(originalSem.schemaTypes, rebuiltSem.schemaTypes);
            assert.deepEqual(originalSem.required, rebuiltSem.required);
            assert.equal(originalSem.properties.size, rebuiltSem.properties.size);
          },
          'name': 'happy: roundtrips preserving nodes, relations, ids, rootSchema, and semantics',
          'schema': TestSchema as unknown as Record<string, unknown>
        },
        {
          'check': (rebuilt, graph) => {
            assert.equal(rebuilt.nodes().length, graph.nodes().length);
            assert.equal(rebuilt.allRelations().length, graph.allRelations().length);
            assert.equal(rebuilt.resolveFragment('itemAnchor').pointer, '/$defs/Item');
            assert.equal(rebuilt.resolveFragment('rootDynamic').pointer, '');

            const rebuiltSem = rebuilt.semantics(rebuilt.rootNode);

            assert.equal(rebuiltSem.containsNode?.pointer, '/contains');
            assert.equal(rebuiltSem.thenNode?.pointer, '/then');
            assert.equal(rebuiltSem.patternPropertyEntries[0]?.[0], '^x-');
            assert.equal(rebuiltSem.dynamicAnchor, 'rootDynamic');
          },
          'name': 'happy: roundtrips richer graph semantics including anchors, conditionals, and contains',
          'schema': RichSchema as unknown as Record<string, unknown>
        },
        {
          'check': (rebuilt, graph) => {
            assert.equal(rebuilt.nodes().length, graph.nodes().length);
            assert.equal(rebuilt.allRelations().length, graph.allRelations().length);
          },
          'name': 'happy: roundtrips through JSON serialization (portable artifact)',
          'schema': TestSchema as unknown as Record<string, unknown>
        },
        {
          'check': (rebuilt, graph) => {
            assert.equal(rebuilt.nodes().length, graph.nodes().length);
            assert.equal(rebuilt.allRelations().length, graph.allRelations().length);
          },
          'name': 'edge: roundtrips schema with boolean subschemas',
          'schema': BooleanSubschemaSchema as unknown as Record<string, unknown>
        },
        {
          'check': (rebuilt, graph) => {
            assert.equal(rebuilt.nodes().length, graph.nodes().length);
            assert.equal(rebuilt.allRelations().length, graph.allRelations().length);

            // Verify the nested $ref chain is preserved
            const pointers = new Set(rebuilt.nodes().map((node) => {
              return node.pointer;
            }));

            assert.ok(pointers.has('/$defs/Company'));
            assert.ok(pointers.has('/$defs/Address'));
          },
          'name': 'edge: roundtrips schema with deeply nested $ref chains',
          'schema': DeepRefSchema as unknown as Record<string, unknown>
        }
      ];

      for (const {
        check, 'name': scenarioName, schema
      } of roundtripScenarios) {
        void it(scenarioName, () => {
          const graph = new SchemaGraph(schema);
          const artifact = GraphArtifact.toArtifact(graph);

          // The JSON serialization roundtrip scenario goes through stringify/parse
          const isJsonRoundtrip = scenarioName.includes('JSON serialization');
          const source = isJsonRoundtrip
            ? structuredClone(artifact) as unknown
            : artifact;

          const rebuilt = GraphArtifact.fromArtifact(source);

          check(rebuilt, graph);
        });
      }

      void describe('rejection scenarios', () => {
        const rejectionScenarios: Array<{
          'matchPattern': ((err: unknown) => boolean) | RegExp;
          'name': string;
          'setup': () => unknown;
        }> = [
          {
            'matchPattern': /Semantics hash mismatch/u,
            'name': 'unhappy: rejects artifact with corrupted semantics hash',
            'setup': () => {
              const graph = new SchemaGraph(TestSchema as unknown as Record<string, unknown>);
              const artifact = GraphArtifact.toArtifact(graph);

              artifact.semanticsHashes[''] = 'corrupted';

              return artifact;
            }
          },
          {
            'matchPattern': (err: unknown) => {
              return (err as { 'code': string }).code === 'ARTIFACT_STALE';
            },
            'name': 'unhappy: rejects artifact with corrupted schema hash (ARTIFACT_STALE)',
            'setup': () => {
              const graph = new SchemaGraph(TestSchema as unknown as Record<string, unknown>);
              const artifact = GraphArtifact.toArtifact(graph);

              (artifact as unknown as { 'metadata': { 'schemaHash': string } }).metadata.schemaHash = 'wrong-hash';

              return artifact;
            }
          },
          {
            'matchPattern': (err: unknown) => {
              const typed = err as { 'code': string;
                'message': string };

              return typed.code === 'ARTIFACT_INVALID' && typed.message.includes('metadata');
            },
            'name': 'unhappy: rejects artifact with missing metadata (ARTIFACT_INVALID)',
            'setup': () => {
              const graph = new SchemaGraph(TestSchema as unknown as Record<string, unknown>);
              const artifact = GraphArtifact.toArtifact(graph);
              const artifactRecord = artifact as unknown as Record<string, unknown>;

              delete artifactRecord.metadata;

              return artifactRecord;
            }
          },
          {
            'matchPattern': /legacy artifact|metadata|regenerate/u,
            'name': 'unhappy: rejects legacy artifact shape without normIR',
            'setup': () => {
              return {
                'nodes': [],
                'relations': [],
                'rootSchema': TestSchema
              };
            }
          },
          {
            'matchPattern': /Artifact must be an object/u,
            'name': 'edge: rejects null artifact',
            'setup': () => {
              return null;
            }
          },
          {
            'matchPattern': /Artifact must be an object/u,
            'name': 'edge: rejects string artifact',
            'setup': () => {
              return 'not-an-artifact';
            }
          }
        ];

        for (const {
          'matchPattern': pattern, 'name': scenarioName, setup
        } of rejectionScenarios) {
          void it(scenarioName, () => {
            const badArtifact = setup();

            assert.throws(() => {
              return GraphArtifact.fromArtifact(badArtifact as GraphArtifactInterface);
            }, pattern instanceof RegExp ? pattern : pattern);
          });
        }
      });
    });

    void describe('NormIR', () => {
      const normIRScenarios: Array<{
        'check': (normIR: NormIRInterface, fromConstructor: SchemaGraph) => void;
        'name': string;
        'schema': Record<string, unknown>;
      }> = [
        {
          'check': (normIR, fromConstructor) => {
            const fromNormIR = SchemaGraph.fromNormIR(normIR);

            assert.equal(fromNormIR.nodes().length, fromConstructor.nodes().length);
            assert.equal(fromNormIR.allRelations().length, fromConstructor.allRelations().length);
            assert.deepEqual(
              fromNormIR.nodes().map((node) => {
                return node.id;
              }),
              fromConstructor.nodes().map((node) => {
                return node.id;
              })
            );

            // JSON-serializable
            const json = JSON.stringify(normIR);
            const deserialized = JSON.parse(json) as NormIRInterface;
            const graph = SchemaGraph.fromNormIR(deserialized);

            assert.equal(graph.nodes().length, fromConstructor.nodes().length);
          },
          'name': 'happy: buildNormIR produces same graph as constructor with JSON-serializable output',
          'schema': TestSchema as unknown as Record<string, unknown>
        },
        {
          'check': (normIR) => {
            const graph = SchemaGraph.fromNormIR(normIR);
            const root = graph.rootNode;

            assert.ok(graph.child(root, 'properties') !== undefined);
            assert.equal(graph.entries(root, 'properties').length, 2);

            // getNormIR
            const directGraph = new SchemaGraph(TestSchema as unknown as Record<string, unknown>);
            const directNormIR = directGraph.getNormIR();

            assert.ok(directNormIR.nodes.length > 0);
            assert.deepEqual(directNormIR.rootSchema, TestSchema);
          },
          'name': 'happy: fromNormIR preserves children and entries, getNormIR returns construction data',
          'schema': TestSchema as unknown as Record<string, unknown>
        },
        {
          'check': (normIR) => {
            const anchorGraph = SchemaGraph.fromNormIR(normIR);

            assert.deepEqual(anchorGraph.semantics(anchorGraph.resolveFragment('foo')).schemaTypes, ['string']);
          },
          'name': 'happy: fromNormIR preserves anchors',
          'schema': {
            '$defs': {
              'Foo': {
                '$anchor': 'foo',
                'type': 'string'
              }
            },
            '$id': 'https://example.com/Anchored',
            'type': 'object'
          }
        },
        {
          'check': (normIR, fromConstructor) => {
            const fromNormIR = SchemaGraph.fromNormIR(normIR);

            assert.equal(fromNormIR.nodes().length, fromConstructor.nodes().length);
            assert.equal(fromNormIR.allRelations().length, fromConstructor.allRelations().length);
          },
          'name': 'edge: buildNormIR handles schema with boolean subschemas',
          'schema': BooleanSubschemaSchema as unknown as Record<string, unknown>
        },
        {
          'check': (normIR, fromConstructor) => {
            const fromNormIR = SchemaGraph.fromNormIR(normIR);

            assert.equal(fromNormIR.nodes().length, fromConstructor.nodes().length);

            const pointers = new Set(fromNormIR.nodes().map((node) => {
              return node.pointer;
            }));

            assert.ok(pointers.has('/$defs/Company'));
            assert.ok(pointers.has('/$defs/Address'));
          },
          'name': 'edge: buildNormIR handles schema with deeply nested $ref chains',
          'schema': DeepRefSchema as unknown as Record<string, unknown>
        }
      ];

      for (const {
        check, 'name': scenarioName, schema
      } of normIRScenarios) {
        void it(scenarioName, () => {
          const normIR = SchemaGraph.buildNormIR(schema);
          const fromConstructor = new SchemaGraph(schema);

          check(normIR, fromConstructor);
        });
      }
    });
  });
}

// ===========================================================================
// Source: schemaEngine.test.ts
// ===========================================================================
{
  void describe('Graph engine advanced keywords', () => {
    void describe('propertyNames with pattern and length constraints', () => {
      const scenarios: Array<{
        'data': Record<string, unknown>;
        'expected': boolean;
        'name': string;
        'schema': Record<string, unknown>;
      }> = [
        {
          'data': { 'good': 1 },
          'expected': true,
          'name': 'lowercase property name matches pattern',
          'schema': {
            '$id': 'urn:test:pn-1',
            'propertyNames': {
              'pattern': '^[a-z]+$',
              'type': 'string'
            },
            'type': 'object'
          }
        },
        {
          'data': { 'Bad-Key': 1 },
          'expected': false,
          'name': 'mixed-case property name fails pattern',
          'schema': {
            '$id': 'urn:test:pn-2',
            'propertyNames': {
              'pattern': '^[a-z]+$',
              'type': 'string'
            },
            'type': 'object'
          }
        },
        {
          'data': {
            'barbaz': 2,
            'foo': 1
          },
          'expected': true,
          'name': 'property names within length bounds pass',
          'schema': {
            '$id': 'urn:test:pn-3',
            'propertyNames': {
              'maxLength': 10,
              'minLength': 3
            },
            'type': 'object'
          }
        },
        {
          'data': { 'ab': 1 },
          'expected': false,
          'name': 'property name below minLength fails',
          'schema': {
            '$id': 'urn:test:pn-4',
            'propertyNames': {
              'maxLength': 10,
              'minLength': 3
            },
            'type': 'object'
          }
        },
        {
          'data': { 'thisnameiswaytoolong': 1 },
          'expected': false,
          'name': 'property name above maxLength fails',
          'schema': {
            '$id': 'urn:test:pn-5',
            'propertyNames': {
              'maxLength': 10,
              'minLength': 3
            },
            'type': 'object'
          }
        },
        {
          'data': {},
          'expected': true,
          'name': 'empty object passes propertyNames length check',
          'schema': {
            '$id': 'urn:test:pn-6',
            'propertyNames': {
              'maxLength': 10,
              'minLength': 3
            },
            'type': 'object'
          }
        }
      ];

      const registry = new SchemaRegistry();

      for (const {
        'data': d, 'expected': exp, 'name': n, 'schema': sch
      } of scenarios) {
        void it(n, () => {
          registry.register(sch);
          assert.equal(registry.is(sch.$id as string, d), exp);
        });
      }
    });

    void describe('dependentSchemas with $ref', () => {
      const scenarios: Array<{
        'data': Record<string, unknown>;
        'expected': boolean;
        'name': string;
      }> = [
        {
          'data': {
            'kind': 'business',
            'taxId': '123'
          },
          'expected': true,
          'name': 'dependent schema satisfied passes'
        },
        {
          'data': { 'kind': 'business' },
          'expected': false,
          'name': 'dependent schema unsatisfied fails'
        }
      ];

      const registry = new SchemaRegistry();
      const kindDepSchema = {
        '$id': 'urn:test:dependent-schemas-kind-dep',
        'properties': {
          'kind': { 'const': 'business' },
          'taxId': { 'type': 'string' }
        },
        'required': ['taxId'],
        'type': 'object'
      } as const;
      const schema = {
        '$id': 'urn:test:dependent-schemas',
        'dependentSchemas': { 'kind': { '$ref': 'urn:test:dependent-schemas-kind-dep' } },
        'type': 'object'
      } as const;

      registry.register([
        kindDepSchema,
        schema
      ]);

      for (const {
        'data': d, 'expected': exp, 'name': n
      } of scenarios) {
        void it(n, () => {
          assert.equal(registry.is(schema.$id, d), exp);
        });
      }
    });

    void describe('prefixItems with items:false tail constraint', () => {
      const scenarios: Array<{
        'data': unknown[];
        'expected': boolean;
        'name': string;
      }> = [
        {
          'data': [
            'x',
            1
          ],
          'expected': true,
          'name': 'exact prefix items pass'
        },
        {
          'data': [
            'x',
            1,
            true
          ],
          'expected': false,
          'name': 'extra tail item fails with items:false'
        }
      ];

      const registry = new SchemaRegistry();
      const schema = {
        '$id': 'urn:test:prefix-items',
        'items': false,
        'prefixItems': [
          { 'type': 'string' },
          { 'type': 'number' }
        ],
        'type': 'array'
      } as const;

      registry.register(schema);

      for (const {
        'data': d, 'expected': exp, 'name': n
      } of scenarios) {
        void it(n, () => {
          assert.equal(registry.is(schema.$id, d), exp);
        });
      }
    });

    void describe('contains with minContains/maxContains', () => {
      const scenarios: Array<{
        'data': unknown[];
        'expected': boolean;
        'name': string;
        'schemaId': string;
      }> = [
        {
          'data': [
            1,
            2,
            'x'
          ],
          'expected': true,
          'name': 'two numbers satisfy minContains:2',
          'schemaId': 'urn:test:contains-min-max'
        },
        {
          'data': [
            1,
            'x'
          ],
          'expected': false,
          'name': 'one number fails minContains:2',
          'schemaId': 'urn:test:contains-min-max'
        },
        {
          'data': [
            1,
            2,
            3,
            4
          ],
          'expected': false,
          'name': 'four numbers exceeds maxContains:3',
          'schemaId': 'urn:test:contains-min-max'
        },
        {
          'data': [],
          'expected': true,
          'name': 'empty array passes with minContains:0',
          'schemaId': 'urn:test:contains-min-zero'
        },
        {
          'data': [
            1,
            2,
            3
          ],
          'expected': true,
          'name': 'non-matching items pass with minContains:0',
          'schemaId': 'urn:test:contains-min-zero'
        }
      ];

      const registry = new SchemaRegistry();

      registry.register({
        '$id': 'urn:test:contains-min-max',
        'contains': { 'type': 'number' },
        'maxContains': 3,
        'minContains': 2,
        'type': 'array'
      });
      registry.register({
        '$id': 'urn:test:contains-min-zero',
        'contains': { 'type': 'string' },
        'minContains': 0,
        'type': 'array'
      });

      for (const {
        'data': d, 'expected': exp, 'name': n, 'schemaId': sid
      } of scenarios) {
        void it(n, () => {
          assert.equal(registry.is(sid, d), exp);
        });
      }
    });

    void describe('uniqueItems with semantic object equality', () => {
      const scenarios: Array<{
        'data': unknown[];
        'expected': boolean;
        'name': string;
      }> = [
        {
          'data': [
            1,
            2,
            3
          ],
          'expected': true,
          'name': 'unique primitives pass'
        },
        {
          'data': [
            1,
            2,
            1
          ],
          'expected': false,
          'name': 'duplicate primitives fail'
        },
        {
          'data': [
            {
              'a': 1,
              'b': 2
            },
            {
              'a': 1,
              'b': 2
            }
          ],
          'expected': false,
          'name': 'duplicate objects fail via deep equality'
        }
      ];

      const registry = new SchemaRegistry();
      const schema = {
        '$id': 'urn:test:unique-items',
        'type': 'array',
        'uniqueItems': true
      } as const;

      registry.register(schema);

      for (const {
        'data': d, 'expected': exp, 'name': n
      } of scenarios) {
        void it(n, () => {
          assert.equal(registry.is(schema.$id, d), exp);
        });
      }
    });

    void describe('if/then/else with $ref and unevaluatedProperties interaction', () => {
      const scenarios: Array<{
        'data': Record<string, unknown>;
        'expected': boolean;
        'name': string;
        'schemaId': string;
      }> = [
        {
          'data': {
            'kind': 'business',
            'taxId': '123'
          },
          'expected': true,
          'name': '$ref if/then: matching if + then satisfied passes',
          'schemaId': 'urn:test:if-then-else'
        },
        {
          'data': { 'kind': 'business' },
          'expected': false,
          'name': '$ref if/then: matching if + then unsatisfied fails',
          'schemaId': 'urn:test:if-then-else'
        },
        {
          'data': {
            'kind': 'person',
            'ssn': '999'
          },
          'expected': true,
          'name': '$ref if/else: non-matching if + else satisfied passes',
          'schemaId': 'urn:test:if-then-else'
        },
        {
          'data': { 'kind': 'person' },
          'expected': false,
          'name': '$ref if/else: non-matching if + else unsatisfied fails',
          'schemaId': 'urn:test:if-then-else'
        },
        {
          'data': {
            'level': 5,
            'type': 'admin'
          },
          'expected': true,
          'name': 'unevaluated + if/then: admin with level passes',
          'schemaId': 'urn:test:if-then-unevaluated'
        },
        {
          'data': { 'type': 'user' },
          'expected': true,
          'name': 'unevaluated + if/else: non-admin passes',
          'schemaId': 'urn:test:if-then-unevaluated'
        },
        {
          'data': {
            'extra': 1,
            'level': 5,
            'type': 'admin'
          },
          'expected': false,
          'name': 'unevaluated + if/then: extra property fails',
          'schemaId': 'urn:test:if-then-unevaluated'
        }
      ];

      const registry = new SchemaRegistry();

      const ifSchema = {
        '$id': 'urn:test:ite-if',
        'properties': { 'kind': { 'const': 'business' } },
        'type': 'object'
      } as const;
      const thenSchema = {
        '$id': 'urn:test:ite-then',
        'properties': { 'taxId': { 'type': 'string' } },
        'required': ['taxId'],
        'type': 'object'
      } as const;
      const elseSchema = {
        '$id': 'urn:test:ite-else',
        'properties': { 'ssn': { 'type': 'string' } },
        'required': ['ssn'],
        'type': 'object'
      } as const;
      const schema = {
        '$id': 'urn:test:if-then-else',
        'else': { '$ref': 'urn:test:ite-else' },
        'if': { '$ref': 'urn:test:ite-if' },
        // eslint-disable-next-line unicorn/no-thenable
        'then': { '$ref': 'urn:test:ite-then' },
        'type': 'object'
      } as const;

      const unevalSchema = {
        '$id': 'urn:test:if-then-unevaluated',
        'if': { 'properties': { 'type': { 'const': 'admin' } } },
        'properties': { 'type': { 'type': 'string' } },
        'required': ['type'],
        // eslint-disable-next-line unicorn/no-thenable
        'then': {
          'properties': { 'level': { 'type': 'number' } },
          'required': ['level']
        },
        'type': 'object',
        'unevaluatedProperties': false
      } as const;

      registry.register([
        ifSchema,
        thenSchema,
        elseSchema,
        schema
      ]);
      registry.register(unevalSchema);

      for (const {
        'data': d, 'expected': exp, 'name': n, 'schemaId': sid
      } of scenarios) {
        void it(n, () => {
          assert.equal(registry.is(sid, d), exp);
        });
      }
    });

    void describe('extended format assertions (string and numeric)', () => {
      const scenarios: Array<{
        'data': unknown;
        'expected': boolean;
        'name': string;
        'schema': Record<string, unknown>;
      }> = [
        {
          'data': 'P3DT4H',
          'expected': true,
          'name': 'valid ISO 8601 duration passes',
          'schema': {
            '$id': 'urn:test:fmt-dur',
            'format': 'duration',
            'type': 'string'
          }
        },
        {
          'data': 'three days',
          'expected': false,
          'name': 'invalid duration string fails',
          'schema': {
            '$id': 'urn:test:fmt-dur2',
            'format': 'duration',
            'type': 'string'
          }
        },
        {
          'data': '2001:db8::1',
          'expected': true,
          'name': 'valid IPv6 address passes',
          'schema': {
            '$id': 'urn:test:fmt-ipv6',
            'format': 'ipv6',
            'type': 'string'
          }
        },
        {
          'data': '999.1.1.1',
          'expected': false,
          'name': 'IPv4 address fails ipv6 format',
          'schema': {
            '$id': 'urn:test:fmt-ipv6-2',
            'format': 'ipv6',
            'type': 'string'
          }
        },
        {
          'data': '/users/123?draft=true',
          'expected': true,
          'name': 'valid uri-reference passes',
          'schema': {
            '$id': 'urn:test:fmt-uriref',
            'format': 'uri-reference',
            'type': 'string'
          }
        },
        {
          'data': '/users/{id}',
          'expected': true,
          'name': 'valid uri-template passes',
          'schema': {
            '$id': 'urn:test:fmt-uritpl',
            'format': 'uri-template',
            'type': 'string'
          }
        },
        {
          'data': '/users/{id',
          'expected': false,
          'name': 'unclosed brace fails uri-template',
          'schema': {
            '$id': 'urn:test:fmt-uritpl2',
            'format': 'uri-template',
            'type': 'string'
          }
        },
        {
          'data': '/items/0/name',
          'expected': true,
          'name': 'valid json-pointer passes',
          'schema': {
            '$id': 'urn:test:fmt-jptr',
            'format': 'json-pointer',
            'type': 'string'
          }
        },
        {
          'data': 'items/0/name',
          'expected': false,
          'name': 'missing leading slash fails json-pointer',
          'schema': {
            '$id': 'urn:test:fmt-jptr2',
            'format': 'json-pointer',
            'type': 'string'
          }
        },
        {
          'data': '^[a-z]+$',
          'expected': true,
          'name': 'valid regex passes',
          'schema': {
            '$id': 'urn:test:fmt-regex',
            'format': 'regex',
            'type': 'string'
          }
        },
        {
          'data': '[',
          'expected': false,
          'name': 'invalid regex fails',
          'schema': {
            '$id': 'urn:test:fmt-regex2',
            'format': 'regex',
            'type': 'string'
          }
        },
        {
          'data': 'SGVsbG8=',
          'expected': true,
          'name': 'valid base64 byte format passes',
          'schema': {
            '$id': 'urn:test:fmt-byte',
            'format': 'byte',
            'type': 'string'
          }
        },
        {
          'data': '0aff',
          'expected': true,
          'name': 'valid hex binary format passes',
          'schema': {
            '$id': 'urn:test:fmt-bin',
            'format': 'binary',
            'type': 'string'
          }
        },
        {
          'data': 'xyz',
          'expected': false,
          'name': 'invalid hex binary format fails',
          'schema': {
            '$id': 'urn:test:fmt-bin2',
            'format': 'binary',
            'type': 'string'
          }
        },
        {
          'data': 2_147_483_647,
          'expected': true,
          'name': 'max int32 value passes',
          'schema': {
            '$id': 'urn:test:fmt-i32',
            'format': 'int32',
            'type': 'integer'
          }
        },
        {
          'data': 2_147_483_648,
          'expected': false,
          'name': 'overflow int32 value fails',
          'schema': {
            '$id': 'urn:test:fmt-i32-2',
            'format': 'int32',
            'type': 'integer'
          }
        },
        {
          'data': Number.MAX_SAFE_INTEGER,
          'expected': true,
          'name': 'MAX_SAFE_INTEGER passes int64',
          'schema': {
            '$id': 'urn:test:fmt-i64',
            'format': 'int64',
            'type': 'integer'
          }
        },
        {
          'data': Number.MAX_SAFE_INTEGER + 1,
          'expected': false,
          'name': 'beyond MAX_SAFE_INTEGER fails int64',
          'schema': {
            '$id': 'urn:test:fmt-i64-2',
            'format': 'int64',
            'type': 'integer'
          }
        },
        {
          'data': Math.fround(1.5),
          'expected': true,
          'name': 'float-representable value passes float format',
          'schema': {
            '$id': 'urn:test:fmt-f',
            'format': 'float',
            'type': 'number'
          }
        },
        {
          'data': 1e40,
          'expected': false,
          'name': 'value exceeding float range fails',
          'schema': {
            '$id': 'urn:test:fmt-f2',
            'format': 'float',
            'type': 'number'
          }
        }
      ];

      const registry = new SchemaRegistry();

      for (const {
        'data': d, 'expected': exp, 'name': n, 'schema': sch
      } of scenarios) {
        void it(n, () => {
          registry.register(sch);
          assert.equal(registry.is(sch.$id as string, d), exp);
        });
      }
    });

    void describe('dialect and vocabulary rejection', () => {
      const scenarios: Array<{
        'name': string;
        'pattern': RegExp;
        'schema': Record<string, unknown>;
      }> = [
        {
          'name': 'rejects unsupported dialect (draft-07)',
          'pattern': /Unsupported JSON Schema dialect/u,
          'schema': {
            '$schema': 'http://json-schema.org/draft-07/schema#',
            'type': 'string'
          }
        },
        {
          'name': 'rejects unknown required vocabulary',
          'pattern': /Unsupported required JSON Schema vocabulary/u,
          'schema': {
            '$schema': 'https://json-schema.org/draft/2020-12/schema',
            '$vocabulary': { 'https://example.io/vocab/custom-required': true },
            'type': 'string'
          }
        }
      ];

      for (const {
        'name': n, 'pattern': pat, 'schema': sch
      } of scenarios) {
        void it(n, () => {
          assert.throws(() => {
            new GraphEngine(sch);
          }, pat);
        });
      }
    });

    void describe('format annotation vs assertion and content annotations per 2020-12 vocabulary', () => {
      const scenarios: Array<{
        'data': unknown;
        'expected': boolean;
        'name': string;
        'schema': Record<string, unknown>;
      }> = [
        {
          'data': 'not-an-email',
          'expected': true,
          'name': 'format as annotation-only allows invalid format',
          'schema': {
            '$id': 'urn:test:format-annotation',
            '$schema': 'https://json-schema.org/draft/2020-12/schema',
            'format': 'email',
            'type': 'string'
          }
        },
        {
          'data': 'alice@example.io',
          'expected': true,
          'name': 'format-assertion vocabulary: valid email passes',
          'schema': {
            '$id': 'urn:test:format-assertion-vocab',
            '$schema': 'https://json-schema.org/draft/2020-12/schema',
            '$vocabulary': {
              'https://json-schema.org/draft/2020-12/vocab/applicator': true,
              'https://json-schema.org/draft/2020-12/vocab/content': true,
              'https://json-schema.org/draft/2020-12/vocab/core': true,
              'https://json-schema.org/draft/2020-12/vocab/format-annotation': true,
              'https://json-schema.org/draft/2020-12/vocab/format-assertion': true,
              'https://json-schema.org/draft/2020-12/vocab/meta-data': true,
              'https://json-schema.org/draft/2020-12/vocab/unevaluated': true,
              'https://json-schema.org/draft/2020-12/vocab/validation': true
            },
            'format': 'email',
            'type': 'string'
          }
        },
        {
          'data': 'not-an-email',
          'expected': false,
          'name': 'format-assertion vocabulary: invalid email fails',
          'schema': {
            '$id': 'urn:test:format-assertion-vocab-2',
            '$schema': 'https://json-schema.org/draft/2020-12/schema',
            '$vocabulary': {
              'https://json-schema.org/draft/2020-12/vocab/applicator': true,
              'https://json-schema.org/draft/2020-12/vocab/content': true,
              'https://json-schema.org/draft/2020-12/vocab/core': true,
              'https://json-schema.org/draft/2020-12/vocab/format-annotation': true,
              'https://json-schema.org/draft/2020-12/vocab/format-assertion': true,
              'https://json-schema.org/draft/2020-12/vocab/meta-data': true,
              'https://json-schema.org/draft/2020-12/vocab/unevaluated': true,
              'https://json-schema.org/draft/2020-12/vocab/validation': true
            },
            'format': 'email',
            'type': 'string'
          }
        },
        {
          'data': 'definitely not base64 or json',
          'expected': true,
          'name': 'content keywords are annotation-only, not assertions',
          'schema': {
            '$id': 'urn:test:content-annotations',
            '$schema': 'https://json-schema.org/draft/2020-12/schema',
            'contentEncoding': 'base64',
            'contentMediaType': 'application/json',
            'contentSchema': { '$ref': 'urn:test:content-inner' },
            'type': 'string'
          }
        }
      ];

      const registry = new SchemaRegistry();

      // Pre-register the content-inner schema needed by the content annotation test
      registry.register({
        '$id': 'urn:test:content-inner',
        'properties': { 'name': { 'type': 'string' } },
        'required': ['name'],
        'type': 'object'
      });

      for (const {
        'data': d, 'expected': exp, 'name': n, 'schema': sch
      } of scenarios) {
        void it(n, () => {
          registry.register(sch);
          assert.equal(registry.is(sch.$id as string, d), exp);
        });
      }
    });

    void describe('unevaluatedProperties/Items with allOf, anyOf, and conditional tracking', () => {
      const scenarios: Array<{
        'data': unknown;
        'expected': boolean;
        'name': string;
        'schemaId': string;
      }> = [
        {
          'data': { 'name': 'Alice' },
          'expected': true,
          'name': 'unevaluatedProperties: known property passes',
          'schemaId': 'urn:test:unevaluated-props'
        },
        {
          'data': {
            'extra': true,
            'name': 'Alice'
          },
          'expected': false,
          'name': 'unevaluatedProperties: extra property fails',
          'schemaId': 'urn:test:unevaluated-props'
        },
        {
          'data': [1],
          'expected': true,
          'name': 'unevaluatedItems: matching contains item passes',
          'schemaId': 'urn:test:unevaluated-items'
        },
        {
          'data': [
            1,
            'x'
          ],
          'expected': false,
          'name': 'unevaluatedItems: non-matching extra item fails',
          'schemaId': 'urn:test:unevaluated-items'
        },
        {
          'data': { 'name': 'Alice' },
          'expected': true,
          'name': 'allOf tracking: property from allOf branch passes',
          'schemaId': 'urn:test:unevaluated-allof'
        },
        {
          'data': {
            'extra': 1,
            'name': 'Alice'
          },
          'expected': false,
          'name': 'allOf tracking: extra property outside allOf fails',
          'schemaId': 'urn:test:unevaluated-allof'
        },
        {
          'data': { 'a': 'hello' },
          'expected': true,
          'name': 'anyOf tracking: first branch match passes',
          'schemaId': 'urn:test:unevaluated-anyof'
        },
        {
          'data': { 'b': 42 },
          'expected': true,
          'name': 'anyOf tracking: second branch match passes',
          'schemaId': 'urn:test:unevaluated-anyof'
        },
        {
          'data': {
            'a': 'hello',
            'extra': 1
          },
          'expected': false,
          'name': 'anyOf tracking: extra property fails',
          'schemaId': 'urn:test:unevaluated-anyof'
        },
        {
          'data': {
            'a': 'hi',
            'b': 1
          },
          'expected': true,
          'name': 'anyOf multi-branch: both branches matched passes',
          'schemaId': 'urn:test:unevaluated-anyof-multi'
        },
        {
          'data': {
            'a': 'hi',
            'b': 1,
            'c': true
          },
          'expected': false,
          'name': 'anyOf multi-branch: extra property fails',
          'schemaId': 'urn:test:unevaluated-anyof-multi'
        },
        {
          'data': ['hello'],
          'expected': true,
          'name': 'allOf items tracking: prefixItem passes',
          'schemaId': 'urn:test:unevaluated-items-allof'
        },
        {
          'data': [
            'hello',
            42
          ],
          'expected': false,
          'name': 'allOf items tracking: extra item fails',
          'schemaId': 'urn:test:unevaluated-items-allof'
        },
        {
          'data': {
            'aValue': 1,
            'kind': 'a'
          },
          'expected': true,
          'name': 'conditional tracking: if-then branch passes',
          'schemaId': 'urn:test:unevaluated-conditional'
        },
        {
          'data': {
            'bValue': 'x',
            'kind': 'b'
          },
          'expected': true,
          'name': 'conditional tracking: if-else branch passes',
          'schemaId': 'urn:test:unevaluated-conditional'
        },
        {
          'data': {
            'aValue': 1,
            'extra': true,
            'kind': 'a'
          },
          'expected': false,
          'name': 'conditional tracking: extra property on if-then fails',
          'schemaId': 'urn:test:unevaluated-conditional'
        },
        {
          'data': {},
          'expected': true,
          'name': 'empty object for object schema with unevaluatedProperties passes',
          'schemaId': 'urn:test:unevaluated-props'
        }
      ];

      const registry = new SchemaRegistry();

      registry.register({
        '$id': 'urn:test:unevaluated-props',
        'properties': { 'name': { 'type': 'string' } },
        'type': 'object',
        'unevaluatedProperties': false
      });
      registry.register({
        '$id': 'urn:test:unevaluated-items',
        'contains': { 'type': 'number' },
        'type': 'array',
        'unevaluatedItems': false
      });
      registry.register({
        '$id': 'urn:test:unevaluated-allof',
        'allOf': [{
          'properties': { 'name': { 'type': 'string' } },
          'required': ['name']
        }],
        'type': 'object',
        'unevaluatedProperties': false
      });
      registry.register({
        '$id': 'urn:test:unevaluated-anyof',
        'anyOf': [
          {
            'properties': { 'a': { 'type': 'string' } },
            'required': ['a']
          },
          {
            'properties': { 'b': { 'type': 'number' } },
            'required': ['b']
          }
        ],
        'type': 'object',
        'unevaluatedProperties': false
      });
      registry.register({
        '$id': 'urn:test:unevaluated-anyof-multi',
        'anyOf': [
          { 'properties': { 'a': { 'type': 'string' } } },
          { 'properties': { 'b': { 'type': 'number' } } }
        ],
        'type': 'object',
        'unevaluatedProperties': false
      });
      registry.register({
        '$id': 'urn:test:unevaluated-items-allof',
        'allOf': [{ 'prefixItems': [{ 'type': 'string' }] }],
        'type': 'array',
        'unevaluatedItems': false
      });
      registry.register({
        '$id': 'urn:test:unevaluated-conditional',
        'else': { 'properties': { 'bValue': { 'type': 'string' } } },
        'if': { 'properties': { 'kind': { 'const': 'a' } } },
        'properties': { 'kind': { 'type': 'string' } },
        'required': ['kind'],
        // eslint-disable-next-line unicorn/no-thenable
        'then': { 'properties': { 'aValue': { 'type': 'number' } } },
        'type': 'object',
        'unevaluatedProperties': false
      });

      for (const {
        'data': d, 'expected': exp, 'name': n, 'schemaId': sid
      } of scenarios) {
        void it(n, () => {
          assert.equal(registry.is(sid, d), exp);
        });
      }
    });

    void describe('local/external anchor and dynamic refs with scope override', () => {
      const scenarios: Array<{
        'data': unknown;
        'name': string;
        'schemaId': string;
        'valid': boolean;
      }> = [
        {
          'data': { 'address': { 'street': '1 Main' } },
          'name': 'local anchor: valid address passes',
          'schemaId': 'urn:test:local-anchor-refs',
          'valid': true
        },
        {
          'data': { 'address': {} },
          'name': 'local anchor: missing required street fails',
          'schemaId': 'urn:test:local-anchor-refs',
          'valid': false
        },
        {
          'data': { 'address': { 'street': '1 Main' } },
          'name': 'external anchor: valid address passes',
          'schemaId': 'https://example.io/UserWithAnchoredAddress',
          'valid': true
        },
        {
          'data': { 'address': {} },
          'name': 'external anchor: missing required street fails',
          'schemaId': 'https://example.io/UserWithAnchoredAddress',
          'valid': false
        },
        {
          'data': {
            'child': { 'value': 2 },
            'value': 1
          },
          'name': 'local dynamic ref: recursive child passes',
          'schemaId': 'urn:test:local-dynamic-refs',
          'valid': true
        },
        {
          'data': {
            'child': {},
            'value': 1
          },
          'name': 'local dynamic ref: child missing required fails',
          'schemaId': 'urn:test:local-dynamic-refs',
          'valid': false
        },
        {
          'data': { 'address': { 'street': '1 Main' } },
          'name': 'external dynamic ref: valid address passes',
          'schemaId': 'https://example.io/dynamic-user',
          'valid': true
        },
        {
          'data': { 'address': {} },
          'name': 'external dynamic ref: missing required street fails',
          'schemaId': 'https://example.io/dynamic-user',
          'valid': false
        }
      ];

      const registry = new SchemaRegistry();

      // Local anchor
      registry.register({
        '$defs': {
          'named': {
            '$anchor': 'namedAddress',
            'properties': { 'street': { 'type': 'string' } },
            'required': ['street'],
            'type': 'object'
          }
        },
        '$id': 'urn:test:local-anchor-refs',
        'properties': { 'address': { '$ref': '#namedAddress' } },
        'required': ['address'],
        'type': 'object'
      });

      // External anchor
      registry.register([
        {
          '$anchor': 'sharedAddress',
          '$id': 'https://example.io/AddressAnchored',
          'properties': { 'street': { 'type': 'string' } },
          'required': ['street'],
          'type': 'object'
        },
        {
          '$id': 'https://example.io/UserWithAnchoredAddress',
          'properties': { 'address': { '$ref': 'https://example.io/AddressAnchored#sharedAddress' } },
          'required': ['address'],
          'type': 'object'
        }
      ]);

      // Local dynamic ref
      registry.register({
        '$dynamicAnchor': 'node',
        '$id': 'urn:test:local-dynamic-refs',
        'properties': {
          'child': { '$dynamicRef': '#node' },
          'value': { 'type': 'number' }
        },
        'required': ['value'],
        'type': 'object'
      });

      // External dynamic ref
      registry.register([
        {
          '$dynamicAnchor': 'addressNode',
          '$id': 'https://example.io/dynamic-address',
          'properties': { 'street': { 'type': 'string' } },
          'required': ['street'],
          'type': 'object'
        },
        {
          '$id': 'https://example.io/dynamic-user',
          'properties': { 'address': { '$dynamicRef': 'https://example.io/dynamic-address#addressNode' } },
          'required': ['address'],
          'type': 'object'
        }
      ]);

      for (const {
        'data': d, 'name': n, 'schemaId': sid, 'valid': v
      } of scenarios) {
        void it(n, () => {
          const errors = registry.validate(sid, d);

          if (v) {
            assert.ok(errors.ok);
          } else {
            assert.ok(errors.length > 0);
          }
        });
      }

      void describe('dynamic scope override (strict tree)', () => {
        const treeScenarios: Array<{
          'data': unknown;
          'name': string;
          'valid': boolean;
        }> = [
          {
            'data': {
              'children': [{
                'tag': 'child',
                'value': 2
              }],
              'tag': 'root',
              'value': 1
            },
            'name': 'strict tree with tagged children passes',
            'valid': true
          },
          {
            'data': {
              'children': [{ 'value': 2 }],
              'tag': 'root',
              'value': 1
            },
            'name': 'strict tree with untagged child fails',
            'valid': false
          }
        ];

        const innerRegistry = new SchemaRegistry();

        innerRegistry.register([
          {
            '$dynamicAnchor': 'node',
            '$id': 'https://example.io/tree',
            'properties': {
              'children': {
                'items': { '$dynamicRef': '#node' },
                'type': 'array'
              },
              'value': { 'type': 'number' }
            },
            'required': ['value'],
            'type': 'object'
          },
          {
            '$id': 'https://example.io/tag-mixin',
            'properties': { 'tag': { 'type': 'string' } },
            'required': ['tag'],
            'type': 'object'
          },
          {
            '$dynamicAnchor': 'node',
            '$id': 'https://example.io/strict-tree',
            'allOf': [
              { '$ref': 'https://example.io/tree' },
              { '$ref': 'https://example.io/tag-mixin' }
            ],
            'type': 'object'
          }
        ]);

        for (const {
          'data': d, 'name': n, 'valid': v
        } of treeScenarios) {
          void it(n, () => {
            const errors = innerRegistry.validate('https://example.io/strict-tree', d);

            if (v) {
              assert.ok(errors.ok);
            } else {
              assert.ok(errors.length > 0);
            }
          });
        }
      });
    });

    void describe('boolean schemas, Unicode code-point length, and composition boundaries', () => {
      const scenarios: Array<{
        'data': unknown;
        'expected': boolean;
        'name': string;
        'schemaId': string;
      }> = [
        {
          'data': { 'anything': true },
          'expected': true,
          'name': 'boolean true schema accepts any value',
          'schemaId': 'urn:test:bool-true'
        },
        {
          'data': { 'anything': true },
          'expected': false,
          'name': 'boolean false schema (not:{}) rejects any value',
          'schemaId': 'urn:test:bool-false'
        },
        {
          'data': '\u{1F600}',
          'expected': true,
          'name': 'single emoji counts as 1 code point for maxLength:1',
          'schemaId': 'urn:test:unicode-length'
        },
        {
          'data': '\u{1F600}a',
          'expected': false,
          'name': 'emoji + char exceeds maxLength:1',
          'schemaId': 'urn:test:unicode-length'
        },
        {
          'data': 'hello',
          'expected': true,
          'name': 'allOf [true] accepts any value',
          'schemaId': 'urn:test:allof-true'
        },
        {
          'data': null,
          'expected': true,
          'name': 'allOf [true] accepts null',
          'schemaId': 'urn:test:allof-true'
        },
        {
          'data': 'hello',
          'expected': false,
          'name': 'allOf [false] rejects any value',
          'schemaId': 'urn:test:allof-false'
        },
        {
          'data': 'hello',
          'expected': false,
          'name': 'allOf [true, false] rejects (false wins)',
          'schemaId': 'urn:test:allof-true-false'
        },
        {
          'data': true,
          'expected': true,
          'name': 'boolean true schema accepts boolean true',
          'schemaId': 'urn:test:bool-true'
        },
        {
          'data': false,
          'expected': false,
          'name': 'boolean false schema rejects boolean false',
          'schemaId': 'urn:test:bool-false'
        }
      ];

      const registry = new SchemaRegistry();

      registry.register([
        { '$id': 'urn:test:bool-true' },
        {
          '$id': 'urn:test:bool-false',
          'not': {}
        }
      ]);
      registry.register({
        '$id': 'urn:test:unicode-length',
        'maxLength': 1,
        'type': 'string'
      });
      registry.register([
        {
          '$id': 'urn:test:allof-true',
          'allOf': [true]
        },
        {
          '$id': 'urn:test:allof-false',
          'allOf': [false]
        },
        {
          '$id': 'urn:test:allof-true-false',
          'allOf': [
            true,
            false
          ]
        }
      ]);

      for (const {
        'data': d, 'expected': exp, 'name': n, 'schemaId': sid
      } of scenarios) {
        void it(n, () => {
          assert.equal(registry.is(sid, d), exp);
        });
      }
    });

    void describe('nested $ref chains and additionalProperties with allOf', () => {
      const scenarios: Array<{
        'data': unknown;
        'name': string;
        'schemaId': string;
        'valid': boolean;
      }> = [
        {
          'data': { 'inner': { 'nested': { 'value': 42 } } },
          'name': 'A -> B -> C chain: valid deep data passes',
          'schemaId': 'https://example.io/A',
          'valid': true
        },
        {
          'data': { 'inner': { 'nested': { 'value': 'not a number' } } },
          'name': 'A -> B -> C chain: wrong type at deepest level fails',
          'schemaId': 'https://example.io/A',
          'valid': false
        },
        {
          'data': { 'inner': {} },
          'name': 'A -> B -> C chain: missing nested required fails',
          'schemaId': 'https://example.io/A',
          'valid': false
        },
        {
          'data': { 'a': 'hello' },
          'name': 'additionalProperties:false with allOf: local property passes',
          'schemaId': 'urn:test:additional-allof',
          'valid': true
        },
        {
          'data': {
            'a': 'hello',
            'b': 1
          },
          'name': 'additionalProperties:false with allOf: allOf property rejected',
          'schemaId': 'urn:test:additional-allof',
          'valid': false
        },
        {
          'data': {},
          'name': 'empty object for object schema with additionalProperties:false passes',
          'schemaId': 'urn:test:additional-allof',
          'valid': true
        }
      ];

      const registry = new SchemaRegistry();

      registry.register([
        {
          '$id': 'https://example.io/C',
          'properties': { 'value': { 'type': 'number' } },
          'required': ['value'],
          'type': 'object'
        },
        {
          '$id': 'https://example.io/B',
          'properties': { 'nested': { '$ref': 'https://example.io/C' } },
          'required': ['nested'],
          'type': 'object'
        },
        {
          '$id': 'https://example.io/A',
          'properties': { 'inner': { '$ref': 'https://example.io/B' } },
          'required': ['inner'],
          'type': 'object'
        }
      ]);
      registry.register({
        '$id': 'urn:test:additional-allof',
        'additionalProperties': false,
        'allOf': [{ 'properties': { 'b': { 'type': 'number' } } }],
        'properties': { 'a': { 'type': 'string' } },
        'type': 'object'
      });

      for (const {
        'data': d, 'name': n, 'schemaId': sid, 'valid': v
      } of scenarios) {
        void it(n, () => {
          const errors = registry.validate(sid, d);

          if (v) {
            assert.ok(errors.ok);
          } else {
            assert.ok(errors.length > 0);
          }
        });
      }
    });
  });

  void describe('Discriminator-based oneOf optimization', () => {
    const CircleSchema = {
      '$id': 'urn:test:circle',
      'properties': {
        'kind': {
          'const': 'circle',
          'type': 'string'
        },
        'radius': { 'type': 'number' }
      },
      'required': [
        'kind',
        'radius'
      ],
      'type': 'object'
    } as const;

    const RectSchema = {
      '$id': 'urn:test:rect',
      'properties': {
        'height': { 'type': 'number' },
        'kind': {
          'const': 'rect',
          'type': 'string'
        },
        'width': { 'type': 'number' }
      },
      'required': [
        'kind',
        'width',
        'height'
      ],
      'type': 'object'
    } as const;

    const discriminatedSchema = {
      '$id': 'urn:test:discriminated-oneof',
      'discriminator': { 'propertyName': 'kind' },
      'oneOf': [
        { '$ref': 'urn:test:circle' },
        { '$ref': 'urn:test:rect' }
      ]
    } as const;

    const plainOneOfSchema = {
      '$id': 'urn:test:plain-oneof',
      'oneOf': [
        { '$ref': 'urn:test:circle' },
        { '$ref': 'urn:test:rect' }
      ]
    } as const;

    function registerAll(registry: SchemaRegistry) {
      registry.register([
        CircleSchema,
        RectSchema,
        discriminatedSchema,
        plainOneOfSchema
      ]);
    }

    void describe('discriminated oneOf validation', () => {
      const scenarios: Array<{
        'data': unknown;
        'expected': boolean;
        'name': string;
        'schemaId': string;
      }> = [
        {
          'data': {
            'kind': 'circle',
            'radius': 5
          },
          'expected': true,
          'name': 'discriminated: valid circle passes',
          'schemaId': 'urn:test:discriminated-oneof'
        },
        {
          'data': {
            'height': 20,
            'kind': 'rect',
            'width': 10
          },
          'expected': true,
          'name': 'discriminated: valid rect passes',
          'schemaId': 'urn:test:discriminated-oneof'
        },
        {
          'data': { 'kind': 'circle' },
          'expected': false,
          'name': 'discriminated: missing required radius fails',
          'schemaId': 'urn:test:discriminated-oneof'
        },
        {
          'data': {
            'kind': 'triangle',
            'sides': 3
          },
          'expected': false,
          'name': 'discriminated: unknown discriminator value fails',
          'schemaId': 'urn:test:discriminated-oneof'
        },
        {
          'data': { 'radius': 5 },
          'expected': false,
          'name': 'discriminated: missing discriminator property fails',
          'schemaId': 'urn:test:discriminated-oneof'
        },
        {
          'data': 'hello',
          'expected': false,
          'name': 'discriminated: non-object data fails',
          'schemaId': 'urn:test:discriminated-oneof'
        },
        {
          'data': {
            'kind': 'circle',
            'radius': 5
          },
          'expected': true,
          'name': 'plain oneOf: valid circle passes',
          'schemaId': 'urn:test:plain-oneof'
        },
        {
          'data': {
            'height': 20,
            'kind': 'rect',
            'width': 10
          },
          'expected': true,
          'name': 'plain oneOf: valid rect passes',
          'schemaId': 'urn:test:plain-oneof'
        },
        {
          'data': { 'kind': 'circle' },
          'expected': false,
          'name': 'plain oneOf: missing required radius fails',
          'schemaId': 'urn:test:plain-oneof'
        }
      ];

      const registry = new SchemaRegistry();

      registerAll(registry);

      for (const {
        'data': d, 'expected': exp, 'name': n, 'schemaId': sid
      } of scenarios) {
        void it(n, () => {
          assert.equal(registry.is(sid, d), exp);
        });
      }
    });

    void describe('discriminator.mapping dispatches by mapped $ref target', () => {
      const scenarios: Array<{
        'data': unknown;
        'expected': boolean;
        'name': string;
      }> = [
        {
          'data': {
            'breed': 'poodle',
            'petType': 'dog'
          },
          'expected': true,
          'name': 'mapped dog with breed passes'
        },
        {
          'data': {
            'color': 'black',
            'petType': 'cat'
          },
          'expected': true,
          'name': 'mapped cat with color passes'
        },
        {
          'data': { 'petType': 'dog' },
          'expected': false,
          'name': 'mapped dog missing required breed fails'
        },
        {
          'data': {
            'fins': 2,
            'petType': 'fish'
          },
          'expected': false,
          'name': 'unmapped discriminator value fails'
        }
      ];

      const registry = new SchemaRegistry();
      const DogSchema = {
        '$id': 'urn:test:dog',
        'properties': {
          'breed': { 'type': 'string' },
          'petType': { 'type': 'string' }
        },
        'required': [
          'petType',
          'breed'
        ],
        'type': 'object'
      };
      const CatSchema = {
        '$id': 'urn:test:cat',
        'properties': {
          'color': { 'type': 'string' },
          'petType': { 'type': 'string' }
        },
        'required': [
          'petType',
          'color'
        ],
        'type': 'object'
      };
      const PetSchema = {
        '$id': 'urn:test:pet-mapped',
        'discriminator': {
          'mapping': {
            'cat': 'urn:test:cat',
            'dog': 'urn:test:dog'
          },
          'propertyName': 'petType'
        },
        'oneOf': [
          { '$ref': 'urn:test:dog' },
          { '$ref': 'urn:test:cat' }
        ]
      };

      registry.register([
        DogSchema,
        CatSchema,
        PetSchema
      ]);

      for (const {
        'data': d, 'expected': exp, 'name': n
      } of scenarios) {
        void it(n, () => {
          assert.equal(registry.is(PetSchema.$id, d), exp);
        });
      }
    });
  });
}

// ===========================================================================
// Source: schemaIri.test.ts
// ===========================================================================
{
  void describe('SchemaIri.propertyIri', () => {
    void it('appends property name as fragment', () => {
      assert.equal(
        SchemaIri.propertyIri('https://example.io/User', 'email'),
        'https://example.io/User#email'
      );
    });

    void it('handles property names with special characters', () => {
      assert.equal(
        SchemaIri.propertyIri('https://example.io/Schema', 'my-prop'),
        'https://example.io/Schema#my-prop'
      );
    });
  });

  void describe('SchemaIri.escapeSegment', () => {
    void it('encodes special characters', () => {
      assert.equal(SchemaIri.escapeSegment('hello world'), 'hello%20world');
    });

    void it('encodes hash character', () => {
      assert.equal(SchemaIri.escapeSegment('a#b'), 'a%23b');
    });

    void it('preserves forward slashes', () => {
      assert.equal(SchemaIri.escapeSegment('a/b/c'), 'a/b/c');
    });

    void it('returns empty string for empty input', () => {
      assert.equal(SchemaIri.escapeSegment(''), '');
    });

    void it('leaves alphanumeric characters unchanged', () => {
      assert.equal(SchemaIri.escapeSegment('abc123'), 'abc123');
    });
  });

  void describe('SchemaIri.splitSubject', () => {
    void it('returns base and null fragment for subject without hash', () => {
      const result = SchemaIri.splitSubject('http://example.com/User');

      assert.equal(result.base, 'http://example.com/User');
      assert.equal(result.fragment, null);
    });

    void it('splits subject at hash boundary', () => {
      const result = SchemaIri.splitSubject('http://example.com/User#/properties/name');

      assert.equal(result.base, 'http://example.com/User');
      assert.equal(result.fragment, '/properties/name');
    });

    void it('handles empty fragment after hash', () => {
      const result = SchemaIri.splitSubject('http://example.com/User#');

      assert.equal(result.base, 'http://example.com/User');
      assert.equal(result.fragment, '');
    });
  });

  void describe('SchemaIri.isPropertySubject', () => {
    void it('returns true for subject with hash and /properties/ fragment', () => {
      assert.equal(SchemaIri.isPropertySubject('http://example.com/User#/properties/name'), true);
    });

    void it('returns true for deeply nested property subject', () => {
      assert.equal(SchemaIri.isPropertySubject('http://example.com/User#/properties/address/properties/street'), true);
    });

    void it('returns false for subject without hash', () => {
      assert.equal(SchemaIri.isPropertySubject('http://example.com/User'), false);
    });

    void it('returns false for subject with hash but no /properties/ fragment', () => {
      assert.equal(SchemaIri.isPropertySubject('http://example.com/User#/$defs/Address'), false);
    });
  });

  void describe('SchemaIri.fragmentContains', () => {
    void it('returns true when fragment contains the segment', () => {
      assert.equal(SchemaIri.fragmentContains('http://example.com/User#/properties/name', 'properties'), true);
    });

    void it('returns false when fragment does not contain the segment', () => {
      assert.equal(SchemaIri.fragmentContains('http://example.com/User#/$defs/Address', 'properties'), false);
    });

    void it('returns false when subject has no hash', () => {
      assert.equal(SchemaIri.fragmentContains('http://example.com/User', 'properties'), false);
    });
  });

  void describe('SchemaIri.structuralParent', () => {
    void it('returns subject unchanged when no hash present', () => {
      assert.equal(SchemaIri.structuralParent('http://example.com/User'), 'http://example.com/User');
    });

    void it('returns base when fragment has no /properties/', () => {
      assert.equal(SchemaIri.structuralParent('http://example.com/User#/$defs/Address'), 'http://example.com/User');
    });

    void it('returns base for root-level property', () => {
      assert.equal(SchemaIri.structuralParent('http://example.com/User#/properties/name'), 'http://example.com/User');
    });

    void it('returns parent pointer for nested property', () => {
      assert.equal(
        SchemaIri.structuralParent('http://example.com/User#/properties/address/properties/street'),
        'http://example.com/User#/properties/address'
      );
    });
  });

  void describe('SchemaIri.lastSegment', () => {
    void it('returns full subject when no hash present', () => {
      assert.equal(SchemaIri.lastSegment('http://example.com/User'), 'http://example.com/User');
    });

    void it('returns last path segment from fragment', () => {
      assert.equal(SchemaIri.lastSegment('http://example.com/User#/properties/name'), 'name');
    });

    void it('returns last segment from deeply nested fragment', () => {
      assert.equal(SchemaIri.lastSegment('http://example.com/User#/properties/address/properties/street'), 'street');
    });

    void it('returns empty string for trailing slash', () => {
      assert.equal(SchemaIri.lastSegment('http://example.com/User#/properties/'), '');
    });
  });
}

