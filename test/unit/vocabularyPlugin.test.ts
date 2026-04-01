import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { SchemaRegistry } from '../../src/modules/registry/schemaRegistry.js';
import { SchemaGraph } from '../../src/modules/graph/schemaGraph.js';
import { GraphOntologySerializer } from '../../src/modules/ontology/graphOntologySerializer.js';
import { GraphShaclSerializer } from '../../src/modules/ontology/graphShaclSerializer.js';
import { Curie } from '../../src/modules/rdf/curie.js';
import { DEFAULT_PREFIXES } from '../../src/constants/PREFIXES.js';
import { JsonTology } from '../../src/JsonTology.js';
import type { VocabularyPluginInterface } from '../../src/interfaces/VocabularyPlugin.js';
import type { SchemaGraphRelationInterface } from '../../src/interfaces/SchemaGraph.js';
import type { QuadInterface } from '../../src/interfaces/Quad.js';

const ACME_NS = 'https://acme.org/vocab#';

const AcmeSchema = {
  '$id': 'https://example.io/AcmeWidget',
  'properties': {
    'name': { 'type': 'string' },
    'priority': { 'type': 'integer' }
  },
  'required': ['name'],
  'type': 'object'
} as const;

function acmePlugin(overrides?: Partial<VocabularyPluginInterface>): VocabularyPluginInterface {
  return {
    'prefixes': { 'acme': ACME_NS },
    ...overrides
  };
}

void describe('VocabularyPlugin', () => {
  void describe('prefix merging', () => {
    const scenarios: Array<{
      'assertions': (registry: SchemaRegistry) => void;
      'name': string;
      'plugin': VocabularyPluginInterface;
    }> = [
      {
        assertions(registry) {
          assert.ok(registry.curie !== undefined);
          const expanded = registry.curie.expand('acme:Widget');

          assert.equal(expanded, `${ACME_NS}Widget`);
        },
        'name': 'merges plugin prefixes into Curie via SchemaRegistry',
        'plugin': acmePlugin()
      },
      {
        assertions(registry) {
          assert.ok(registry.curie !== undefined);
          assert.equal(registry.curie.expand('owl:Class'), 'http://www.w3.org/2002/07/owl#Class');
          assert.equal(registry.curie.expand('acme:Widget'), `${ACME_NS}Widget`);
        },
        'name': 'expands default prefixes alongside plugin prefixes',
        'plugin': acmePlugin()
      },
      {
        assertions(registry) {
          assert.ok(registry.curie !== undefined);
          const expanded = registry.curie.expand('schema:Person');

          assert.equal(expanded, 'https://custom-schema.org/Person');
          assert.notEqual(expanded, 'http://schema.org/Person');
        },
        'name': 'overrides a default prefix when plugin uses the same prefix name',
        'plugin': { 'prefixes': { 'schema': 'https://custom-schema.org/' } }
      }
    ];

    for (const {
      assertions, name, plugin
    } of scenarios) {
      void it(name, () => {
        const registry = new SchemaRegistry({ 'vocabularies': [plugin] });

        assertions(registry);
      });
    }
  });

  void describe('extractRelations', () => {
    const scenarios: Array<{
      'assertions': () => void;
      'name': string;
    }> = [
      {
        assertions() {
          const customRelation: SchemaGraphRelationInterface = {
            'predicate': `${ACME_NS}priority`,
            'source': {
              'id': 'placeholder',
              'pointer': '',
              'schema': {}
            },
            'target': 'high'
          };

          const plugin = acmePlugin({
            extractRelations(node) {
              if (node.pointer === '') {
                return [{
                  ...customRelation,
                  'source': node
                }];
              }

              return [];
            }
          });

          const schema = {
            '$id': 'https://example.io/Test',
            'properties': { 'name': { 'type': 'string' as const } },
            'type': 'object' as const
          };

          const graph = new SchemaGraph(schema, [plugin]);
          const allRelations = graph.allRelations();
          const acmeRelations = allRelations.filter((rel) => {
            return rel.predicate === `${ACME_NS}priority`;
          });

          assert.equal(acmeRelations.length, 1);
          assert.equal(acmeRelations[0]?.target, 'high');
          assert.equal(acmeRelations[0]?.source.pointer, '');
        },
        'name': 'includes custom relations from plugin during graph construction'
      },
      {
        assertions() {
          const plugin = acmePlugin({
            extractRelations() {
              return [];
            }
          });

          const schema = {
            '$id': 'https://example.io/EmptyRel',
            'properties': { 'x': { 'type': 'number' as const } },
            'type': 'object' as const
          };

          const graph = new SchemaGraph(schema, [plugin]);
          const allRelations = graph.allRelations();
          const acmeRelations = allRelations.filter((rel) => {
            return rel.predicate.startsWith(ACME_NS);
          });

          assert.equal(acmeRelations.length, 0);
          assert.ok(allRelations.length > 0);
        },
        'name': 'returns empty array from extractRelations without breaking graph'
      }
    ];

    for (const {
      assertions, name
    } of scenarios) {
      void it(name, () => {
        assertions();
      });
    }
  });

  void describe('project', () => {
    const scenarios: Array<{
      'assertions': () => void;
      'name': string;
    }> = [
      {
        assertions() {
          const emittedQuads: QuadInterface[] = [];

          const plugin: VocabularyPluginInterface = {
            extractRelations(node) {
              if (node.pointer === '') {
                return [{
                  'predicate': `${ACME_NS}category`,
                  'source': node,
                  'target': 'industrial'
                }];
              }

              return [];
            },
            'prefixes': { 'acme': ACME_NS },
            project(relation, emit) {
              if (relation.predicate === `${ACME_NS}category`) {
                const quad: QuadInterface = {
                  'object': {
                    'datatype': {
                      'termType': 'NamedNode',
                      'value': 'http://www.w3.org/2001/XMLSchema#string'
                    },
                    'language': '',
                    'termType': 'Literal',
                    'value': relation.target as string
                  },
                  'predicate': `${ACME_NS}category`,
                  'subject': relation.source.id
                };

                emittedQuads.push(quad);
                emit(quad);
              }
            }
          };

          const registry = new SchemaRegistry({ 'vocabularies': [plugin] });

          registry.register(AcmeSchema as unknown as Record<string, unknown>);

          const curie = new Curie({
            ...DEFAULT_PREFIXES,
            'acme': ACME_NS
          });
          const serializer = new GraphOntologySerializer(curie, [plugin]);
          const nodes = serializer.serialize(registry.listGraphs()) as Array<Record<string, unknown>>;

          assert.ok(emittedQuads.length > 0);

          const widgetNode = nodes.find((node) => {
            return node['@id'] === 'https://example.io/AcmeWidget';
          });

          assert.ok(widgetNode !== undefined);
        },
        'name': 'calls plugin project during OWL serialization for non-core predicates'
      },
      {
        assertions() {
          const projectCalled: string[] = [];

          const plugin: VocabularyPluginInterface = {
            extractRelations(node) {
              if (node.pointer === '') {
                return [{
                  'predicate': `${ACME_NS}level`,
                  'source': node,
                  'target': 'top'
                }];
              }

              return [];
            },
            'prefixes': { 'acme': ACME_NS },
            project(relation, emit) {
              if (relation.predicate.startsWith(ACME_NS)) {
                projectCalled.push(relation.predicate);
                emit({
                  'object': {
                    'datatype': {
                      'termType': 'NamedNode',
                      'value': 'http://www.w3.org/2001/XMLSchema#string'
                    },
                    'language': '',
                    'termType': 'Literal',
                    'value': relation.target as string
                  },
                  'predicate': relation.predicate,
                  'subject': relation.source.id
                });
              }
            }
          };

          const registry = new SchemaRegistry({ 'vocabularies': [plugin] });

          registry.register(AcmeSchema as unknown as Record<string, unknown>);

          const curie = new Curie({
            ...DEFAULT_PREFIXES,
            'acme': ACME_NS
          });
          const serializer = new GraphShaclSerializer(curie, [plugin]);

          serializer.serialize(registry.listGraphs());

          assert.ok(projectCalled.includes(`${ACME_NS}level`));
        },
        'name': 'calls plugin project during SHACL serialization for non-core predicates'
      }
    ];

    for (const {
      assertions, name
    } of scenarios) {
      void it(name, () => {
        assertions();
      });
    }
  });

  void describe('integration', () => {
    const scenarios: Array<{
      'assertions': () => void;
      'name': string;
    }> = [
      {
        assertions() {
          const plugin: VocabularyPluginInterface = { 'prefixes': { 'acme': ACME_NS } };

          const registry = new SchemaRegistry({ 'vocabularies': [plugin] });

          registry.register(AcmeSchema as unknown as Record<string, unknown>);

          const graphs = registry.listGraphs();

          assert.ok(graphs.length > 0);

          const serializer = new GraphOntologySerializer(registry.curie, [plugin]);
          const nodes = serializer.serialize(graphs);

          assert.ok(Array.isArray(nodes));
        },
        'name': 'does not break registration or serialization when plugin has only prefixes'
      },
      {
        assertions() {
          const bioNs = 'https://bio.org/vocab#';
          const geoNs = 'https://geo.org/vocab#';

          const bioPlugin: VocabularyPluginInterface = {
            extractRelations(node) {
              if (node.pointer === '') {
                return [{
                  'predicate': `${bioNs}organism`,
                  'source': node,
                  'target': 'human'
                }];
              }

              return [];
            },
            'prefixes': { 'bio': bioNs }
          };

          const geoPlugin: VocabularyPluginInterface = {
            extractRelations(node) {
              if (node.pointer === '') {
                return [{
                  'predicate': `${geoNs}region`,
                  'source': node,
                  'target': 'EMEA'
                }];
              }

              return [];
            },
            'prefixes': { 'geo': geoNs }
          };

          const registry = new SchemaRegistry({
            'vocabularies': [
              bioPlugin,
              geoPlugin
            ]
          });

          registry.register(AcmeSchema as unknown as Record<string, unknown>);

          assert.ok(registry.curie !== undefined);
          assert.equal(registry.curie.expand('bio:organism'), `${bioNs}organism`);
          assert.equal(registry.curie.expand('geo:region'), `${geoNs}region`);

          const allRelations = registry.listGraphs()[0]?.allRelations() ?? [];
          const bioRelations = allRelations.filter((rel) => {
            return rel.predicate.startsWith(bioNs);
          });
          const geoRelations = allRelations.filter((rel) => {
            return rel.predicate.startsWith(geoNs);
          });

          assert.ok(bioRelations.length > 0);
          assert.ok(geoRelations.length > 0);
        },
        'name': 'applies all plugins and merges their prefixes'
      },
      {
        assertions() {
          const projectCalled: string[] = [];

          const plugin: VocabularyPluginInterface = {
            extractRelations(node) {
              if (node.pointer === '') {
                return [{
                  'predicate': `${ACME_NS}tag`,
                  'source': node,
                  'target': 'e2e-test'
                }];
              }

              return [];
            },
            'prefixes': { 'acme': ACME_NS },
            project(relation, emit) {
              if (relation.predicate.startsWith(ACME_NS)) {
                projectCalled.push(relation.predicate);
                emit({
                  'object': {
                    'datatype': {
                      'termType': 'NamedNode',
                      'value': 'http://www.w3.org/2001/XMLSchema#string'
                    },
                    'language': '',
                    'termType': 'Literal',
                    'value': relation.target as string
                  },
                  'predicate': relation.predicate,
                  'subject': relation.source.id
                });
              }
            }
          };

          const jt = JsonTology.create({
            'baseIRI': 'https://example.io',
            'schemas': [AcmeSchema],
            'vocabularies': [plugin]
          });

          assert.ok(jt.is(AcmeSchema.$id, { 'name': 'test' }));

          const ontology = jt.ontology();
          const jsonLd = ontology.jsonLd();

          assert.ok(jsonLd);
          assert.ok(projectCalled.includes(`${ACME_NS}tag`));
        },
        'name': 'passes vocabulary plugins through JsonTology.create() end-to-end'
      },
      {
        assertions() {
          const extractCalls: string[] = [];

          const plugin: VocabularyPluginInterface = {
            extractRelations(node) {
              extractCalls.push(node.pointer);

              return [];
            },
            'prefixes': { 'acme': ACME_NS }
          };

          const registry = new SchemaRegistry({ 'vocabularies': [plugin] });

          registry.register(AcmeSchema as unknown as Record<string, unknown>);

          const graph = registry.graph(AcmeSchema.$id);

          assert.ok(graph !== undefined);

          graph.allRelations();

          assert.ok(extractCalls.length > 0);
          assert.ok(extractCalls.includes(''));
        },
        'name': 'passes vocabulary plugins to SchemaGraph during SchemaRegistry graph construction'
      }
    ];

    for (const {
      assertions, name
    } of scenarios) {
      void it(name, () => {
        assertions();
      });
    }
  });
});
