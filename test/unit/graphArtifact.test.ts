import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import type { GraphArtifactInterface } from '../../src/modules/graph/GraphArtifact.js';
import { GraphArtifact } from '../../src/modules/graph/GraphArtifact.js';
import type { NormIRInterface } from '../../src/interfaces/schema-graph.js';
import { SchemaGraph } from '../../src/modules/graph/SchemaGraph.js';

void describe('GraphArtifact', () => {
  const TestSchema = {
    '$id': 'https://example.com/Test',
    'properties': {
      'age': { 'type': 'number' },
      'name': { 'type': 'string' }
    },
    'required': ['name'],
    'type': 'object'
  } as const;

  void describe('toArtifact', () => {
    void it('serializes the canonical artifact shape with normIR', () => {
      const graph = new SchemaGraph(TestSchema);
      const artifact = GraphArtifact.toArtifact(graph);

      assert.equal(typeof artifact.normIR, 'object');
      assert.equal(typeof artifact.semanticsHashes, 'object');
      assert.deepEqual(artifact.normIR.rootSchema, TestSchema);
    });

    void it('stores NormIR nodes with pointers', () => {
      const graph = new SchemaGraph(TestSchema);
      const artifact = GraphArtifact.toArtifact(graph);
      const pointers = new Set(artifact.normIR.nodes.map((node) => {
        return node.pointer;
      }));

      // root
      assert.ok(pointers.has(''));
      assert.ok(pointers.has('/properties'));
      assert.ok(pointers.has('/properties/name'));
    });

    void it('stores semantics hashes per node', () => {
      const graph = new SchemaGraph(TestSchema);
      const artifact = GraphArtifact.toArtifact(graph);

      // root
      assert.ok('' in artifact.semanticsHashes);
      assert.ok('/properties/name' in artifact.semanticsHashes);
    });

    void it('stores NormIR structural data', () => {
      const graph = new SchemaGraph(TestSchema);
      const artifact = GraphArtifact.toArtifact(graph);

      assert.ok('' in artifact.normIR.children);
      assert.ok('' in artifact.normIR.entries);
      assert.ok('properties' in artifact.normIR.entries['']);
    });
  });

  void describe('fromArtifact', () => {
    void it('roundtrips through serialization', () => {
      const graph = new SchemaGraph(TestSchema);
      const artifact = GraphArtifact.toArtifact(graph);
      const rebuilt = GraphArtifact.fromArtifact(artifact);

      assert.equal(rebuilt.nodes().length, graph.nodes().length);
      assert.equal(rebuilt.allRelations().length, graph.allRelations().length);
    });

    void it('rehydrates from NormIR without re-lowering', () => {
      const graph = new SchemaGraph(TestSchema);
      const artifact = GraphArtifact.toArtifact(graph);
      const rebuilt = GraphArtifact.fromArtifact(artifact);

      // Verify the rebuilt graph has correct node ids
      const rebuiltIds = rebuilt.nodes().map((node) => {
        return node.id;
      });
      const originalIds = graph.nodes().map((node) => {
        return node.id;
      });

      assert.deepEqual(rebuiltIds, originalIds);
    });

    void it('detects stale artifacts by semantics hash', () => {
      const graph = new SchemaGraph(TestSchema);
      const artifact = GraphArtifact.toArtifact(graph);

      // Corrupt a semantics hash
      artifact.semanticsHashes[''] = 'corrupted';
      assert.throws(() => {
        return GraphArtifact.fromArtifact(artifact);
      }, /Semantics hash mismatch/u);
    });

    void it('rejects legacy artifact shapes and instructs regeneration', () => {
      const corruptedArtifact = {
        'nodes': [],
        'relations': [],
        'rootSchema': TestSchema
      };

      assert.throws(() => {
        return GraphArtifact.fromArtifact(corruptedArtifact as unknown as GraphArtifactInterface);
      }, /legacy artifact|metadata|regenerate/u);
    });

    void it('preserves rootSchema identity', () => {
      const graph = new SchemaGraph(TestSchema);
      const artifact = GraphArtifact.toArtifact(graph);
      const rebuilt = GraphArtifact.fromArtifact(artifact);

      assert.deepEqual(rebuilt.rootSchema, TestSchema);
    });

    void it('roundtrips through JSON serialization (portable artifact)', () => {
      const graph = new SchemaGraph(TestSchema);
      const artifact = GraphArtifact.toArtifact(graph);
      const json = JSON.stringify(artifact);
      const deserialized = JSON.parse(json) as GraphArtifactInterface;
      const rebuilt = GraphArtifact.fromArtifact(deserialized);

      assert.equal(rebuilt.nodes().length, graph.nodes().length);
      assert.equal(rebuilt.allRelations().length, graph.allRelations().length);
    });

    void it('preserves semantics through NormIR rehydration', () => {
      const graph = new SchemaGraph(TestSchema);
      const artifact = GraphArtifact.toArtifact(graph);
      const rebuilt = GraphArtifact.fromArtifact(artifact);

      const originalSem = graph.semantics(graph.rootNode);
      const rebuiltSem = rebuilt.semantics(rebuilt.rootNode);

      assert.deepEqual(originalSem.schemaTypes, rebuiltSem.schemaTypes);
      assert.deepEqual(originalSem.required, rebuiltSem.required);
      assert.equal(originalSem.properties.size, rebuiltSem.properties.size);
    });

    void it('roundtrips richer graph semantics including anchors, conditionals, and contains', () => {
      const richSchema = {
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
        'patternProperties': {
          '^x-': { 'type': 'number' }
        },
        'properties': {
          'child': { '$dynamicRef': '#rootDynamic' },
          'kind': { 'type': 'string' },
          'primary': { '$ref': '#/$defs/Item' }
        },
        'required': [
          'kind',
          'primary'
        ],
        'then': {
          'properties': { 'flag': { 'type': 'boolean' } },
          'type': 'object'
        },
        'type': 'object'
      } as const;

      const graph = new SchemaGraph(richSchema);
      const artifact = GraphArtifact.toArtifact(graph);
      const rebuilt = GraphArtifact.fromArtifact(artifact);

      assert.equal(rebuilt.nodes().length, graph.nodes().length);
      assert.equal(rebuilt.allRelations().length, graph.allRelations().length);
      assert.equal(rebuilt.resolveFragment('itemAnchor').pointer, '/$defs/Item');
      assert.equal(rebuilt.resolveFragment('rootDynamic').pointer, '');

      const rebuiltSem = rebuilt.semantics(rebuilt.rootNode);

      assert.equal(rebuiltSem.containsNode?.pointer, '/contains');
      assert.equal(rebuiltSem.thenNode?.pointer, '/then');
      assert.equal(rebuiltSem.patternPropertyEntries[0]?.[0], '^x-');
      assert.equal(rebuiltSem.dynamicAnchor, 'rootDynamic');
    });
  });

  void describe('NormIR', () => {
    void it('buildNormIR produces same graph as constructor', () => {
      const normIR = SchemaGraph.buildNormIR(TestSchema);
      const fromConstructor = new SchemaGraph(TestSchema);
      const fromNormIR = SchemaGraph.fromNormIR(normIR);

      assert.equal(fromNormIR.nodes().length, fromConstructor.nodes().length);
      assert.equal(fromNormIR.allRelations().length, fromConstructor.allRelations().length);

      const constructorIds = fromConstructor.nodes().map((node) => {
        return node.id;
      });
      const normIRIds = fromNormIR.nodes().map((node) => {
        return node.id;
      });

      assert.deepEqual(normIRIds, constructorIds);
    });

    void it('NormIR is JSON-serializable', () => {
      const normIR = SchemaGraph.buildNormIR(TestSchema);
      const json = JSON.stringify(normIR);
      const deserialized = JSON.parse(json) as NormIRInterface;
      const graph = SchemaGraph.fromNormIR(deserialized);

      assert.equal(graph.nodes().length, new SchemaGraph(TestSchema).nodes().length);
    });

    void it('fromNormIR preserves anchors', () => {
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

    void it('fromNormIR preserves children and entries', () => {
      const normIR = SchemaGraph.buildNormIR(TestSchema);
      const graph = SchemaGraph.fromNormIR(normIR);
      const root = graph.rootNode;
      const propNode = graph.child(root, 'properties');

      assert.ok(propNode !== undefined);
      const propEntries = graph.entries(root, 'properties');

      assert.equal(propEntries.length, 2);
    });

    void it('getNormIR returns the NormIR used for construction', () => {
      const graph = new SchemaGraph(TestSchema);
      const normIR = graph.getNormIR();

      assert.ok(normIR.nodes.length > 0);
      assert.deepEqual(normIR.rootSchema, TestSchema);
    });
  });
});
