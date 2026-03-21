/**
 * Vocabulary plugin interface for extending json-tology with custom RDF vocabularies.
 *
 * Plugins can:
 * - Register custom vocabulary prefixes (prefix → namespace IRI mappings)
 * - Extract custom relations from schema extensions (unknown keywords)
 * - Project custom relations into RDF quads
 */

import type { SchemaGraphInterface } from './schema-graph-impl.js';
import type {
  SchemaGraphNodeInterface,
  SchemaGraphRelationInterface,
  SchemaGraphSemanticsInterface
} from './schema-graph.js';
import type { QuadInterface } from './quad.js';

export interface VocabularyPluginInterface {
  /**
   * Extract custom relations from a schema graph node.
   * Called for each node after core relation extraction.
   * Receives semantics.extensions (unknown keywords) for processing.
   * Returns additional relations to add to the graph.
   */
  extractRelations?(
    node: SchemaGraphNodeInterface,
    semantics: SchemaGraphSemanticsInterface,
    graph: SchemaGraphInterface
  ): SchemaGraphRelationInterface[];

  /** Prefix → namespace IRI mappings. Merged into active Curie instance. */
  'prefixes': Record<string, string>;

  /**
   * Project a relation into RDF quads.
   * Called for relations with predicates not in core RelationPredicateType.
   * Must call emit() for each quad to be included in the output.
   */
  project?(
    relation: SchemaGraphRelationInterface,
    emit: (quad: QuadInterface) => void
  ): void;
}
