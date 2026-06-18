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

import type { SchemaGraphNodeType } from '../../types/SchemaGraph.js';
import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphImpl.js';
import type { GraphArtifactType } from '../../types/GraphArtifact.js';
import { GraphError } from '../../errors/GraphError.js';
import { GraphErrorCode } from '../../constants/ERROR_CODES.js';
import { isRecord } from '../data/DataTypes.js';
import { logScope } from '../data/LogScope.js';
import { SILENT_LOGGER } from '../../constants/LOGGER.js';
import type { LoggerInterface } from '../../interfaces/Logger.js';
import { Hash } from '../hash/Hash.js';
import { SchemaGraph } from './SchemaGraph.js';


export class GraphArtifact {
  /**
   * Reconstruct a SchemaGraph from a serialized artifact (the deserialization
   * half of the `toArtifact` / `fromArtifact` pair used for cached graphs).
   *
   * Rehydrates directly from NormIR without re-lowering, then verifies
   * per-node semantics hashes for staleness.
   *
   * @param artifact - A previously serialized {@link GraphArtifactType}.
   * @param logger - Optional; warns on a stale hash mismatch before throwing
   *   `GraphError ARTIFACT_STALE`. Defaults to the silent logger. Supplied by the
   *   consumer loading the artifact (this is a leaf load entry with no in-tree
   *   caller — `cli.ts` only serializes via `toArtifact`).
   */
  public static fromArtifact(artifact: unknown, logger: LoggerInterface = SILENT_LOGGER): SchemaGraphInterface {
    if (!isRecord(artifact)) {
      throw new GraphError(
        'Artifact must be an object. Regenerate the artifact.',
        { 'code': GraphErrorCode.ARTIFACT_INVALID }
      );
    }

    if (!('metadata' in artifact)) {
      throw new GraphError(
        'Artifact is missing metadata. Regenerate the artifact.',
        { 'code': GraphErrorCode.ARTIFACT_INVALID }
      );
    }

    if (!('normIR' in artifact) || !('semanticsHashes' in artifact)) {
      throw new GraphError(
        'Unsupported legacy artifact format. Regenerate the artifact.',
        { 'code': GraphErrorCode.ARTIFACT_INVALID }
      );
    }

    if (!this.isArtifact(artifact)) {
      throw new GraphError(
        'Artifact shape is invalid. Regenerate the artifact.',
        { 'code': GraphErrorCode.ARTIFACT_INVALID }
      );
    }

    const graph = SchemaGraph.fromNormIR(artifact.normIR);

    // Verify top-level schema hash for fast staleness detection
    const actualSchemaHash = Hash.value(graph.rootSchema);

    if (artifact.metadata.schemaHash !== actualSchemaHash) {
      logger.warn(logScope('GraphArtifact', 'fromArtifact', `schema hash mismatch (artifact=${artifact.metadata.schemaHash}, actual=${actualSchemaHash}); artifact is stale`));
      throw new GraphError(
        `Schema hash mismatch: artifact=${artifact.metadata.schemaHash}, actual=${actualSchemaHash}. Regenerate the artifact.`,
        { 'code': GraphErrorCode.ARTIFACT_STALE }
      );
    }

    // Verify per-node semantics hashes for deep staleness detection
    for (const node of graph.nodes()) {
      const expected = artifact.semanticsHashes[node.pointer];
      const actual = this.hashSemantics(graph, node);

      if (expected !== actual) {
        logger.warn(logScope('GraphArtifact', 'fromArtifact', `semantics hash mismatch at "${node.pointer || '(root)'}" (artifact=${expected}, rebuilt=${actual}); artifact is stale`));
        throw new GraphError(
          `Semantics hash mismatch at ${node.pointer || '(root)'}: artifact=${expected}, rebuilt=${actual}. Regenerate the artifact.`,
          { 'code': GraphErrorCode.ARTIFACT_STALE }
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
  private static hashSemantics(graph: SchemaGraphInterface, node: SchemaGraphNodeType): string {
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

  private static isArtifact(value: unknown): value is GraphArtifactType {
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
  public static toArtifact(graph: SchemaGraphInterface): GraphArtifactType {
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
