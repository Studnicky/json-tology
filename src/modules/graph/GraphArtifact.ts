/**
 * GraphArtifact — canonical-schema transport with staleness verification.
 *
 * v2 artifacts store the NormIR (normalized intermediate representation)
 * directly, enabling true rehydration without re-lowering. Both schema
 * construction and artifact deserialization produce NormIR, which feeds
 * into the single shared `populate()` path in SchemaGraph.
 *
 * Staleness detection uses per-node FNV-1a semantics hashes. On rehydration,
 * each node's hash is verified against what `extractSemantics()` produces
 * from the schema objects. If any hash diverges, the artifact is stale.
 */

import type { JSONSchema7Definition } from 'json-schema';
import type {
  NormIRInterface, SchemaGraphNodeInterface
} from '../../interfaces/schema-graph.js';
import { GraphError } from '../../errors/GraphError.js';
import { Hash } from '../hash/Hash.js';
import { SchemaGraph } from './SchemaGraph.js';

export interface GraphArtifactNodeInterface {
  'id': string;
  'pointer': string;
  'schema': JSONSchema7Definition;
  'semanticsHash': string;
}

export interface GraphArtifactRelationInterface {
  'metadata'?: Record<string, unknown>;
  'predicate': string;
  'sourcePointer': string;
  'target': SchemaGraphNodeInterface | string;
}

export interface GraphArtifactV1Interface {
  'nodes': GraphArtifactNodeInterface[];
  'relations': GraphArtifactRelationInterface[];
  'rootSchema': JSONSchema7Definition;
  'version': 1;
}

export interface GraphArtifactV2Interface {
  'normIR': NormIRInterface;
  'semanticsHashes': Record<string, string>;
  'version': 2;
}

export type GraphArtifactInterface = GraphArtifactV1Interface | GraphArtifactV2Interface;

export class GraphArtifact {
  /**
   * Reconstruct a SchemaGraph from a serialized artifact.
   *
   * v2: rehydrates directly from NormIR without re-lowering, then verifies
   * per-node semantics hashes for staleness.
   *
   * v1 (legacy): rebuilds via `new SchemaGraph(rootSchema)` and verifies
   * node/relation counts plus per-node semantics hashes.
   */
  public static fromArtifact(artifact: GraphArtifactInterface): SchemaGraph {
    if (artifact.version === 2) {
      return this.fromV2Artifact(artifact);
    }

    if (artifact.version === 1) {
      return this.fromV1Artifact(artifact);
    }

    throw new GraphError('ARTIFACT_VERSION', `Unsupported artifact version: ${(artifact as Record<string, unknown>).version}`);
  }

  private static fromV1Artifact(artifact: GraphArtifactV1Interface): SchemaGraph {
    const graph = new SchemaGraph(artifact.rootSchema as boolean | Record<string, unknown>);
    const rebuiltNodes = graph.nodes();

    if (rebuiltNodes.length !== artifact.nodes.length) {
      throw new GraphError(
        'ARTIFACT_STALE',
        `Artifact node count (${artifact.nodes.length}) does not match rebuilt graph (${rebuiltNodes.length}). Regenerate the artifact.`
      );
    }

    if (graph.allRelations().length !== artifact.relations.length) {
      throw new GraphError(
        'ARTIFACT_STALE',
        `Artifact relation count (${artifact.relations.length}) does not match rebuilt graph (${graph.allRelations().length}). Regenerate the artifact.`
      );
    }

    const artifactHashByPointer = new Map(artifact.nodes.map((n) => {
      return [
        n.pointer,
        n.semanticsHash
      ];
    }));

    for (const node of rebuiltNodes) {
      const artifactHash = artifactHashByPointer.get(node.pointer);
      const rebuiltHash = this.hashSemantics(graph, node);

      if (artifactHash !== rebuiltHash) {
        throw new GraphError(
          'ARTIFACT_STALE',
          `Semantics hash mismatch at ${node.pointer || '(root)'}: artifact=${artifactHash}, rebuilt=${rebuiltHash}. Regenerate the artifact.`
        );
      }
    }

    return graph;
  }

  private static fromV2Artifact(artifact: GraphArtifactV2Interface): SchemaGraph {
    const graph = SchemaGraph.fromNormIR(artifact.normIR);

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
  private static hashSemantics(graph: SchemaGraph, node: SchemaGraphNodeInterface): string {
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

  /**
   * Serialize a SchemaGraph into a JSON-serializable v2 artifact.
   */
  public static toArtifact(graph: SchemaGraph): GraphArtifactV2Interface {
    const normIR = graph.getNormIR();
    const semanticsHashes: Record<string, string> = {};

    for (const node of graph.nodes()) {
      semanticsHashes[node.pointer] = this.hashSemantics(graph, node);
    }

    return {
      normIR,
      semanticsHashes,
      'version': 2
    };
  }
}
