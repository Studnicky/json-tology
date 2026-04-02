import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import type { GraphArtifactInterface } from '../../src/interfaces/GraphArtifact.js';
import { GraphArtifact } from '../../src/modules/graph/GraphArtifact.js';
import type { NormIRInterface } from '../../src/interfaces/SchemaGraph.js';
import { SchemaGraph } from '../../src/modules/graph/SchemaGraph.js';

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
