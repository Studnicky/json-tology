/**
 * GraphArtifact — canonical-schema transport with staleness verification.
 *
 * Artifacts store the NormIR (normalized intermediate representation)
 * directly, enabling true rehydration without re-lowering. Both schema
 * construction and artifact deserialization produce NormIR, which feeds
 * into the single shared `populate()` path in SchemaGraph.
 *
 * Staleness detection uses per-node FNV-1a semantics hashes. On rehydration,
 * each node's hash is verified against what `extractSemantics()` produces
 * from the schema objects. If any hash diverges, the artifact is stale.
 */

import type { SchemaGraphNodeInterface } from '../../interfaces/SchemaGraph.js';
import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphImpl.js';
import type { GraphArtifactInterface } from '../../interfaces/GraphArtifact.js';
import { GraphError } from '../../errors/GraphError.js';
import { isRecord } from '../data/dataTypes.js';
import { Hash } from '../hash/Hash.js';
import { SchemaGraph } from './schemaGraph.js';


export class GraphArtifact {
  /**
   * Reconstruct a SchemaGraph from a serialized artifact.
   *
   * Rehydrates directly from NormIR without re-lowering, then verifies
   * per-node semantics hashes for staleness.
   */
  public static fromArtifact(artifact: unknown): SchemaGraphInterface {
    if (!isRecord(artifact)) {
      throw new GraphError(
        'ARTIFACT_INVALID',
        'Artifact must be an object. Regenerate the artifact.'
      );
    }

    if (!('metadata' in artifact)) {
      throw new GraphError(
        'ARTIFACT_INVALID',
        'Artifact is missing metadata. Regenerate the artifact.'
      );
    }

    if (!('normIR' in artifact) || !('semanticsHashes' in artifact)) {
      throw new GraphError(
        'ARTIFACT_INVALID',
        'Unsupported legacy artifact format. Regenerate the artifact.'
      );
    }

    if (!this.isArtifact(artifact)) {
      throw new GraphError(
        'ARTIFACT_INVALID',
        'Artifact shape is invalid. Regenerate the artifact.'
      );
    }

    const graph = SchemaGraph.fromNormIR(artifact.normIR);

    // Verify top-level schema hash for fast staleness detection
    const actualSchemaHash = Hash.value(graph.rootSchema);

    if (artifact.metadata.schemaHash !== actualSchemaHash) {
      throw new GraphError(
        'ARTIFACT_STALE',
        `Schema hash mismatch: artifact=${artifact.metadata.schemaHash}, actual=${actualSchemaHash}. Regenerate the artifact.`
      );
    }

    // Verify per-node semantics hashes for deep staleness detection
    for (const node of graph.nodes()) {
      const expected = artifact.semanticsHashes[node.pointer];
      const actual = this.hashSemantics(graph, node);

      if (expected !== actual) {
        throw new GraphError(
          'ARTIFACT_STALE',
          `Semantics hash mismatch at ${node.pointer || '(root)'}: artifact=${expected}, rebuilt=${actual}. Regenerate the artifact.`
        );
      }
    }

    return graph;
  }

  /**
   * Hash a node's scalar semantics fields using FNV-1a.
   * Excludes node references (which are structural, not semantic)
   * to produce a stable, deterministic hash.
   */
  private static hashSemantics(graph: SchemaGraphInterface, node: SchemaGraphNodeInterface): string {
    const sem = graph.semantics(node);

    // Hash only scalar/primitive semantic fields — node references are structural
    const hashable = {
      'constValue': sem.constValue,
      'contentEncoding': sem.contentEncoding,
      'contentMediaType': sem.contentMediaType,
      'defaultValue': sem.defaultValue,
      'dependentRequired': sem.dependentRequired,
      'deprecated': sem.deprecated,
      'description': sem.description,
      'discriminatorMapping': sem.discriminatorMapping,
      'discriminatorPropertyName': sem.discriminatorPropertyName,
      'dynamicAnchor': sem.dynamicAnchor,
      'dynamicRef': sem.dynamicRef,
      'enumValues': sem.enumValues,
      'exclusiveMaximum': sem.exclusiveMaximum,
      'exclusiveMinimum': sem.exclusiveMinimum,
      'extensions': sem.extensions,
      'format': sem.format,
      'hasConst': sem.hasConst,
      'hasDefault': sem.hasDefault,
      'maxContains': sem.maxContains,
      'maximum': sem.maximum,
      'maxItems': sem.maxItems,
      'maxLength': sem.maxLength,
      'maxProperties': sem.maxProperties,
      'minContains': sem.minContains,
      'minimum': sem.minimum,
      'minItems': sem.minItems,
      'minLength': sem.minLength,
      'minProperties': sem.minProperties,
      'multipleOf': sem.multipleOf,
      'pattern': sem.pattern,
      'readOnly': sem.readOnly,
      'ref': sem.ref,
      'required': sem.required,
      'schemaAnchor': sem.schemaAnchor,
      'schemaDialect': sem.schemaDialect,
      'schemaId': sem.schemaId,
      'schemaTypes': sem.schemaTypes,
      'schemaVocabulary': sem.schemaVocabulary,
      'title': sem.title,
      'uniqueItems': sem.uniqueItems,
      'writeOnly': sem.writeOnly
    };

    return Hash.value(hashable);
  }

  private static isArtifact(value: unknown): value is GraphArtifactInterface {
    if (!isRecord(value)) {
      return false;
    }

    const artifact = value;
    const metadata = artifact.metadata;

    return typeof metadata === 'object'
      && metadata !== null
      && !Array.isArray(metadata)
      && typeof (metadata as Record<string, unknown>).schemaHash === 'string'
      && typeof artifact.normIR === 'object'
      && artifact.normIR !== null
      && !Array.isArray(artifact.normIR)
      && typeof artifact.semanticsHashes === 'object'
      && artifact.semanticsHashes !== null
      && !Array.isArray(artifact.semanticsHashes);
  }

  /**
   * Serialize a SchemaGraph into a JSON-serializable artifact with per-node semantics hashes.
   *
   * @param graph - Schema graph to serialize
   * @returns Artifact containing NormIR, schema hash, and per-node semantics hashes
   */
  public static toArtifact(graph: SchemaGraphInterface): GraphArtifactInterface {
    const normIR = graph.getNormIR();
    const semanticsHashes: Record<string, string> = {};

    for (const node of graph.nodes()) {
      semanticsHashes[node.pointer] = this.hashSemantics(graph, node);
    }

    return {
      'metadata': { 'schemaHash': Hash.value(graph.rootSchema) },
      normIR,
      semanticsHashes
    };
  }
}
