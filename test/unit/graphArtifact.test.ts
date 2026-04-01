import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import type { GraphArtifactInterface } from '../../src/modules/graph/graphArtifact.js';
import { GraphArtifact } from '../../src/modules/graph/graphArtifact.js';
import type { NormIRInterface } from '../../src/interfaces/SchemaGraph.js';
import { SchemaGraph } from '../../src/modules/graph/schemaGraph.js';

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
    void it('serializes canonical artifact shape with normIR, metadata, pointers, hashes, and structural data', () => {
      const graph = new SchemaGraph(TestSchema);
      const artifact = GraphArtifact.toArtifact(graph);

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
    });
  });

  void describe('fromArtifact', () => {
    void it('roundtrips through serialization preserving nodes, relations, ids, rootSchema, and semantics', () => {
      const graph = new SchemaGraph(TestSchema);
      const artifact = GraphArtifact.toArtifact(graph);
      const rebuilt = GraphArtifact.fromArtifact(artifact);

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
    });

    void it('rejects stale, corrupted, and legacy artifacts', () => {
      const graph = new SchemaGraph(TestSchema);

      // Corrupted semantics hash
      const a1 = GraphArtifact.toArtifact(graph);

      a1.semanticsHashes[''] = 'corrupted';
      assert.throws(() => {
        return GraphArtifact.fromArtifact(a1);
      }, /Semantics hash mismatch/u);

      // Corrupted schema hash → ARTIFACT_STALE
      const a2 = GraphArtifact.toArtifact(graph);

      (a2 as unknown as { 'metadata': { 'schemaHash': string } }).metadata.schemaHash = 'wrong-hash';
      assert.throws(() => {
        return GraphArtifact.fromArtifact(a2);
      }, (err: unknown) => {
        return (err as { 'code': string }).code === 'ARTIFACT_STALE';
      });

      // Missing metadata → ARTIFACT_INVALID
      const a3 = GraphArtifact.toArtifact(graph);
      const a3Record = a3 as unknown as Record<string, unknown>;

      delete a3Record.metadata;
      assert.throws(() => {
        return GraphArtifact.fromArtifact(a3Record as unknown as GraphArtifactInterface);
      }, (err: unknown) => {
        const typed = err as { 'code': string;
          'message': string };

        return typed.code === 'ARTIFACT_INVALID' && typed.message.includes('metadata');
      });

      // Legacy artifact shape
      assert.throws(() => {
        return GraphArtifact.fromArtifact({
          'nodes': [],
          'relations': [],
          'rootSchema': TestSchema
        } as unknown as GraphArtifactInterface);
      }, /legacy artifact|metadata|regenerate/u);
    });

    void it('roundtrips through JSON serialization (portable artifact)', () => {
      const graph = new SchemaGraph(TestSchema);
      const artifact = GraphArtifact.toArtifact(graph);
      const json = JSON.stringify(artifact);
      const deserialized: unknown = JSON.parse(json);
      const rebuilt = GraphArtifact.fromArtifact(deserialized);

      assert.equal(rebuilt.nodes().length, graph.nodes().length);
      assert.equal(rebuilt.allRelations().length, graph.allRelations().length);
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
    void it('buildNormIR produces same graph as constructor with JSON-serializable output', () => {
      const normIR = SchemaGraph.buildNormIR(TestSchema);
      const fromConstructor = new SchemaGraph(TestSchema);
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
    });

    void it('fromNormIR preserves anchors, children, entries, and getNormIR returns construction data', () => {
      // Anchors
      const anchorSchema = {
        '$defs': {
          'Foo': {
            '$anchor': 'foo',
            'type': 'string'
          }
        },
        '$id': 'https://example.com/Anchored',
        'type': 'object'
      } as const;
      const anchorNormIR = SchemaGraph.buildNormIR(anchorSchema);
      const anchorGraph = SchemaGraph.fromNormIR(anchorNormIR);

      assert.deepEqual(anchorGraph.semantics(anchorGraph.resolveFragment('foo')).schemaTypes, ['string']);

      // Children and entries
      const normIR = SchemaGraph.buildNormIR(TestSchema);
      const graph = SchemaGraph.fromNormIR(normIR);
      const root = graph.rootNode;

      assert.ok(graph.child(root, 'properties') !== undefined);
      assert.equal(graph.entries(root, 'properties').length, 2);

      // getNormIR
      const directGraph = new SchemaGraph(TestSchema);
      const directNormIR = directGraph.getNormIR();

      assert.ok(directNormIR.nodes.length > 0);
      assert.deepEqual(directNormIR.rootSchema, TestSchema);
    });
  });
});
