import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
// Type-only imports of internal interfaces — required by the SchemaGraph + SchemaRegistry assertions below; not surfaced publicly.
import type { QuadInterface } from '../../src/interfaces/Quad.js';
import type { SchemaGraphRelationInterface } from '../../src/interfaces/SchemaGraph.js';
import type { SchemaRegistryInterface } from '../../src/interfaces/SchemaRegistry.js';
import type { VocabularyPluginInterface } from '../../src/interfaces/VocabularyPlugin.js';
import {
  Curie, GraphOntologySerializer, JsonTology
} from '../../src/index.js';
// Internal access: vocabulary-plugin behaviour is observed at the graph level
// (SchemaGraph construction with the plugin attached) and at the SHACL
// serializer level. SchemaRegistry direct construction is also needed for the
// plugin-prefix-override-default test, since JsonTology re-injects STANDARD_PREFIXES
// after vocabulary merging. These graph + registry surfaces are not part of the
// public JsonTology API and constitute the contract for vocabulary-plugin integration.
import { GraphShaclSerializer } from '../../src/modules/ontology/GraphShaclSerializer.js';
import { JsonLdFormatter } from '../../src/modules/rdf/JsonLdFormatter.js';
import { Terms } from '../../src/modules/rdf/Terms.js';
import { SchemaGraph } from '../../src/modules/graph/SchemaGraph.js';
import { SchemaRegistry } from '../../src/modules/registry/SchemaRegistry.js';
// STANDARD_PREFIXES is the canonical constant injected by JsonTology when constructing prefix maps; not re-exported.
import { STANDARD_PREFIXES } from '../../src/constants/STANDARD_PREFIXES.js';

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
      'assertions': (registry: SchemaRegistryInterface) => void;
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
        // Internal access: JsonTology merges STANDARD_PREFIXES into its own
        // prefixes field and forwards them to registry.prefixes, which
        // overrides plugin prefixes. To test plugin-overrides-default
        // semantics directly, the registry is constructed without that
        // post-merge step.
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

          const graph = new SchemaGraph(schema, { 'vocabularies': [plugin] });
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

          const graph = new SchemaGraph(schema, { 'vocabularies': [plugin] });
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
                const targetValue = typeof relation.target === 'string'
                  ? relation.target
                  : relation.target.id;
                const quad: QuadInterface = Terms.quad(
                  Terms.iri(relation.source.id),
                  Terms.iri(`${ACME_NS}category`),
                  Terms.literal(targetValue, { 'datatype': Terms.iri('http://www.w3.org/2001/XMLSchema#string') })
                );

                emittedQuads.push(quad);
                emit(quad);
              }
            }
          };

          const registry = JsonTology.create({
            'baseIRI': 'https://example.io',
            'vocabularies': [plugin]
          }).registry;

          registry.set(AcmeSchema);

          const curie = new Curie({
            ...STANDARD_PREFIXES,
            'acme': ACME_NS
          });
          const serializer = new GraphOntologySerializer({
            curie,
            'vocabularies': [plugin]
          });
          const nodes = JsonLdFormatter.fromQuads(serializer.serializeQuads(registry.listGraphs()));

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
                const targetValue = typeof relation.target === 'string'
                  ? relation.target
                  : relation.target.id;

                emit(Terms.quad(
                  Terms.iri(relation.source.id),
                  Terms.iri(relation.predicate),
                  Terms.literal(targetValue, { 'datatype': Terms.iri('http://www.w3.org/2001/XMLSchema#string') })
                ));
              }
            }
          };

          const registry = JsonTology.create({
            'baseIRI': 'https://example.io',
            'vocabularies': [plugin]
          }).registry;

          registry.set(AcmeSchema);

          const curie = new Curie({
            ...STANDARD_PREFIXES,
            'acme': ACME_NS
          });
          const serializer = new GraphShaclSerializer({
            curie,
            'vocabularies': [plugin]
          });

          serializer.serializeQuads(registry.listGraphs());

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

  void describe('edge cases', () => {
    const edgeScenarios: Array<{
      'assertions': () => void;
      'name': string;
    }> = [
      {
        assertions() {
          const plugin: VocabularyPluginInterface = {
            extractRelations() {
              return [];
            },
            'prefixes': {}
          };

          const registry = JsonTology.create({
            'baseIRI': 'https://example.io',
            'vocabularies': [plugin]
          }).registry;

          registry.set(AcmeSchema);

          const allRelations = registry.listGraphs()[0]?.allRelations() ?? [];
          const acmeRelations = allRelations.filter((rel) => {
            return rel.predicate.startsWith(ACME_NS);
          });

          assert.equal(acmeRelations.length, 0, 'edge: empty extractRelations — no custom relations');
          assert.ok(allRelations.length > 0, 'edge: empty extractRelations — core relations still present');
        },
        'name': 'edge: plugin with empty extractRelations produces no custom relations'
      },
      {
        assertions() {
          const plugin: VocabularyPluginInterface = { 'prefixes': {} };

          const registry = JsonTology.create({
            'baseIRI': 'https://example.io',
            'vocabularies': [plugin]
          }).registry;

          assert.ok(registry.curie !== undefined, 'edge: empty prefixes — curie exists');
          assert.equal(registry.curie.expand('owl:Class'), 'http://www.w3.org/2002/07/owl#Class', 'edge: empty prefixes — defaults still work');
        },
        'name': 'edge: plugin with empty prefixes does not break default prefix resolution'
      },
      {
        assertions() {
          const ns1 = 'https://plugin-one.org/vocab#';
          const ns2 = 'https://plugin-two.org/vocab#';

          const plugin1: VocabularyPluginInterface = { 'prefixes': { 'shared': ns1 } };

          const plugin2: VocabularyPluginInterface = { 'prefixes': { 'shared': ns2 } };

          const registry = JsonTology.create({
            'baseIRI': 'https://example.io',
            'vocabularies': [
              plugin1,
              plugin2
            ]
          }).registry;

          assert.ok(registry.curie !== undefined, 'edge: conflicting prefixes — curie exists');
          const expanded = registry.curie.expand('shared:Thing');

          assert.ok(
            expanded === `${ns1}Thing` || expanded === `${ns2}Thing`,
            'edge: conflicting prefixes — one of the two namespaces wins'
          );
        },
        'name': 'edge: multiple plugins with conflicting prefixes resolves without error'
      }
    ];

    for (const {
      assertions, name
    } of edgeScenarios) {
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

          const registry = JsonTology.create({
            'baseIRI': 'https://example.io',
            'vocabularies': [plugin]
          }).registry;

          registry.set(AcmeSchema);

          const graphs = registry.listGraphs();

          assert.ok(graphs.length > 0);

          const serializer = new GraphOntologySerializer({
            ...(registry.curie === undefined ? {} : { 'curie': registry.curie }),
            'vocabularies': [plugin]
          });
          const nodes = serializer.serializeQuads(graphs);

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

          const registry = JsonTology.create({
            'baseIRI': 'https://example.io',
            'vocabularies': [
              bioPlugin,
              geoPlugin
            ]
          }).registry;

          registry.set(AcmeSchema);

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
                const targetValue = typeof relation.target === 'string'
                  ? relation.target
                  : relation.target.id;

                emit(Terms.quad(
                  Terms.iri(relation.source.id),
                  Terms.iri(relation.predicate),
                  Terms.literal(targetValue, { 'datatype': Terms.iri('http://www.w3.org/2001/XMLSchema#string') })
                ));
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

          const registry = JsonTology.create({
            'baseIRI': 'https://example.io',
            'vocabularies': [plugin]
          }).registry;

          registry.set(AcmeSchema);

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
