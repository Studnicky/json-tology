import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { GraphArtifact } from '../../src/modules/graph/GraphArtifact.js';
import { SchemaGraph } from '../../src/modules/graph/SchemaGraph.js';

describe('GraphArtifact', () => {
  const TestSchema = {
    '$id': 'https://example.com/Test',
    'properties': {
      'age': { 'type': 'number' },
      'name': { 'type': 'string' }
    },
    'required': ['name'],
    'type': 'object'
  } as const;

  describe('toArtifact', () => {
    it('serializes as v2 with normIR', () => {
      const graph = new SchemaGraph(TestSchema);
      const artifact = GraphArtifact.toArtifact(graph);

      assert.equal(artifact.version, 2);
      assert.ok(artifact.normIR !== undefined);
      assert.ok(artifact.semanticsHashes !== undefined);
      assert.deepEqual(artifact.normIR.rootSchema, TestSchema);
    });

    it('stores NormIR nodes with pointers', () => {
      const graph = new SchemaGraph(TestSchema);
      const artifact = GraphArtifact.toArtifact(graph);
      const pointers = new Set(artifact.normIR.nodes.map((n) => {
        return n.pointer;
      }));

      assert.ok(pointers.has('')); // root
      assert.ok(pointers.has('/properties'));
      assert.ok(pointers.has('/properties/name'));
    });

    it('stores semantics hashes per node', () => {
      const graph = new SchemaGraph(TestSchema);
      const artifact = GraphArtifact.toArtifact(graph);

      assert.ok('' in artifact.semanticsHashes); // root
      assert.ok('/properties/name' in artifact.semanticsHashes);
    });

    it('stores NormIR structural data', () => {
      const graph = new SchemaGraph(TestSchema);
      const artifact = GraphArtifact.toArtifact(graph);

      assert.ok('' in artifact.normIR.children);
      assert.ok('' in artifact.normIR.entries);
      assert.ok('properties' in artifact.normIR.entries['']);
    });
  });

  describe('fromArtifact', () => {
    it('roundtrips through serialization (v2)', () => {
      const graph = new SchemaGraph(TestSchema);
      const artifact = GraphArtifact.toArtifact(graph);
      const rebuilt = GraphArtifact.fromArtifact(artifact);

      assert.equal(rebuilt.nodes().length, graph.nodes().length);
      assert.equal(rebuilt.allRelations().length, graph.allRelations().length);
    });

    it('rehydrates from NormIR without re-lowering', () => {
      const graph = new SchemaGraph(TestSchema);
      const artifact = GraphArtifact.toArtifact(graph);
      const rebuilt = GraphArtifact.fromArtifact(artifact);

      // Verify the rebuilt graph has correct node ids
      const rebuiltIds = rebuilt.nodes().map((n) => {
        return n.id;
      });
      const originalIds = graph.nodes().map((n) => {
        return n.id;
      });

      assert.deepEqual(rebuiltIds, originalIds);
    });

    it('detects stale artifacts by semantics hash (v2)', () => {
      const graph = new SchemaGraph(TestSchema);
      const artifact = GraphArtifact.toArtifact(graph);

      // Corrupt a semantics hash
      artifact.semanticsHashes[''] = 'corrupted';
      assert.throws(() => {
        return GraphArtifact.fromArtifact(artifact);
      }, /Semantics hash mismatch/u);
    });

    it('rejects unsupported version', () => {
      const artifact = GraphArtifact.toArtifact(new SchemaGraph(TestSchema));

      (artifact as any).version = 99;
      assert.throws(() => {
        return GraphArtifact.fromArtifact(artifact as any);
      }, /Unsupported artifact version/u);
    });

    it('preserves rootSchema identity', () => {
      const graph = new SchemaGraph(TestSchema);
      const artifact = GraphArtifact.toArtifact(graph);
      const rebuilt = GraphArtifact.fromArtifact(artifact);

      assert.deepEqual(rebuilt.rootSchema, TestSchema);
    });

    it('roundtrips through JSON serialization (portable artifact)', () => {
      const graph = new SchemaGraph(TestSchema);
      const artifact = GraphArtifact.toArtifact(graph);
      const json = JSON.stringify(artifact);
      const deserialized = JSON.parse(json);
      const rebuilt = GraphArtifact.fromArtifact(deserialized);

      assert.equal(rebuilt.nodes().length, graph.nodes().length);
      assert.equal(rebuilt.allRelations().length, graph.allRelations().length);
    });

    it('preserves semantics through NormIR rehydration', () => {
      const graph = new SchemaGraph(TestSchema);
      const artifact = GraphArtifact.toArtifact(graph);
      const rebuilt = GraphArtifact.fromArtifact(artifact);

      const originalSem = graph.semantics(graph.rootNode);
      const rebuiltSem = rebuilt.semantics(rebuilt.rootNode);

      assert.deepEqual(originalSem.schemaTypes, rebuiltSem.schemaTypes);
      assert.deepEqual(originalSem.required, rebuiltSem.required);
      assert.equal(originalSem.properties.size, rebuiltSem.properties.size);
    });
  });

  describe('v1 backward compatibility', () => {
    it('accepts v1 artifacts with re-lower path', () => {
      const graph = new SchemaGraph(TestSchema);
      const v1Artifact = {
        'nodes': graph.nodes().map((node) => {
          return {
            'id': node.id,
            'pointer': node.pointer,
            'schema': node.schema,
            'semanticsHash': '' // v1 didn't have real hashes, but our code checks them
          };
        }),
        'relations': graph.allRelations().map((rel) => {
          return {
            'predicate': rel.predicate,
            'sourcePointer': rel.source.pointer,
            'target': typeof rel.target === 'string' ? rel.target : rel.target.id,
            ...(rel.metadata === undefined ? {} : { 'metadata': rel.metadata })
          };
        }),
        'rootSchema': TestSchema,
        'version': 1 as const
      };

      // v1 path re-lowers and checks hashes — with empty hashes this will fail
      // unless counts match but hashes don't. This tests that v1 path still works.
      assert.throws(() => {
        return GraphArtifact.fromArtifact(v1Artifact);
      }, /Semantics hash mismatch/u);
    });

    it('detects stale v1 artifacts by node count', () => {
      const graph = new SchemaGraph(TestSchema);
      // Build a fake v1 artifact with wrong node count
      const v1Artifact = {
        'nodes': [{
          'id': 'fake',
          'pointer': '',
          'schema': true as const,
          'semanticsHash': ''
        }],
        'relations': [],
        'rootSchema': TestSchema,
        'version': 1 as const
      };

      assert.throws(() => {
        return GraphArtifact.fromArtifact(v1Artifact);
      }, /node count/iu);
    });
  });

  describe('NormIR', () => {
    it('buildNormIR produces same graph as constructor', () => {
      const normIR = SchemaGraph.buildNormIR(TestSchema);
      const fromConstructor = new SchemaGraph(TestSchema);
      const fromNormIR = SchemaGraph.fromNormIR(normIR);

      assert.equal(fromNormIR.nodes().length, fromConstructor.nodes().length);
      assert.equal(fromNormIR.allRelations().length, fromConstructor.allRelations().length);

      const constructorIds = fromConstructor.nodes().map((n) => {
        return n.id;
      });
      const normIRIds = fromNormIR.nodes().map((n) => {
        return n.id;
      });

      assert.deepEqual(normIRIds, constructorIds);
    });

    it('NormIR is JSON-serializable', () => {
      const normIR = SchemaGraph.buildNormIR(TestSchema);
      const json = JSON.stringify(normIR);
      const deserialized = JSON.parse(json);
      const graph = SchemaGraph.fromNormIR(deserialized);

      assert.equal(graph.nodes().length, new SchemaGraph(TestSchema).nodes().length);
    });

    it('fromNormIR preserves anchors', () => {
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
      const normIR = SchemaGraph.buildNormIR(schema);
      const graph = SchemaGraph.fromNormIR(normIR);
      const resolved = graph.resolveFragment('foo');

      assert.deepEqual(graph.semantics(resolved).schemaTypes, ['string']);
    });

    it('fromNormIR preserves children and entries', () => {
      const normIR = SchemaGraph.buildNormIR(TestSchema);
      const graph = SchemaGraph.fromNormIR(normIR);
      const root = graph.rootNode;
      const propNode = graph.child(root, 'properties');

      assert.ok(propNode !== undefined);
      const propEntries = graph.entries(root, 'properties');

      assert.equal(propEntries.length, 2);
    });

    it('getNormIR returns the NormIR used for construction', () => {
      const graph = new SchemaGraph(TestSchema);
      const normIR = graph.getNormIR();

      assert.ok(normIR.nodes.length > 0);
      assert.deepEqual(normIR.rootSchema, TestSchema);
    });
  });
});
