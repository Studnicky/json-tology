import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import type { GraphArtifactInterface } from '../../src/modules/graph/GraphArtifact.js';
import { GraphArtifact } from '../../src/modules/graph/GraphArtifact.js';
import { SchemaGraph } from '../../src/modules/graph/SchemaGraph.js';

interface ArtifactMetadata {
  'schemaHash': string;
}

interface ArtifactWithMetadata {
  'metadata': ArtifactMetadata;
}

interface ArtifactError {
  'code': string;
  'message': string;
}

void describe('GraphArtifact metadata', () => {
  const TestSchema = {
    '$id': 'https://example.com/Test',
    'properties': {
      'age': { 'type': 'number' },
      'name': { 'type': 'string' }
    },
    'required': ['name'],
    'type': 'object'
  } as const;

  void it('includes metadata field in the canonical artifact', () => {
    const graph = new SchemaGraph(TestSchema);
    const artifact = GraphArtifact.toArtifact(graph) as unknown as ArtifactWithMetadata;

    assert.equal(typeof artifact.metadata, 'object', 'Artifact should have a metadata field');
  });

  void it('includes schemaHash in metadata for staleness detection', () => {
    const graph = new SchemaGraph(TestSchema);
    const artifact = GraphArtifact.toArtifact(graph) as unknown as ArtifactWithMetadata;

    assert.ok(typeof artifact.metadata.schemaHash === 'string', 'Should include schemaHash');
    assert.ok(artifact.metadata.schemaHash.length > 0, 'schemaHash should not be empty');
  });

  void it('verifies schemaHash during fromArtifact rehydration', () => {
    const graph = new SchemaGraph(TestSchema);
    const artifact = GraphArtifact.toArtifact(graph) as unknown as ArtifactWithMetadata;

    // Corrupt the schemaHash
    artifact.metadata.schemaHash = 'wrong-hash';

    assert.throws(() => {
      return GraphArtifact.fromArtifact(artifact as unknown as GraphArtifactInterface);
    }, (err: unknown) => {
      return (err as ArtifactError).code === 'ARTIFACT_STALE';
    }, 'Should throw ARTIFACT_STALE if schemaHash mismatches');
  });

  void it('rejects artifact missing metadata', () => {
    const graph = new SchemaGraph(TestSchema);
    const artifact = GraphArtifact.toArtifact(graph);
    const artifactRecord = artifact as unknown as Record<string, unknown>;

    delete artifactRecord.metadata;

    assert.throws(() => {
      return GraphArtifact.fromArtifact(artifactRecord as unknown as GraphArtifactInterface);
    }, (err: unknown) => {
      const typedErr = err as ArtifactError;

      return typedErr.code === 'ARTIFACT_INVALID' && typedErr.message.includes('metadata');
    });
  });
});
