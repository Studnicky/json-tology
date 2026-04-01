import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphImpl.js';
import type { GraphSerializerInterface } from '../../interfaces/Serializer.js';
import type { CurieInterface } from '../../interfaces/Curie.js';
import type { VocabularyPluginInterface } from '../../interfaces/VocabularyPlugin.js';
import { projectOwlGraph } from '../rdf/owlProjection.js';
import { quadsToJsonLd } from '../rdf/jsonLdFormatter.js';
import { resetBnodeCounter } from '../rdf/projection.js';
import { Curie } from '../rdf/curie.js';
import {
  DEFAULT_PREFIXES, RDFS_SUB_CLASS_OF_IRI
} from '../../constants/PREFIXES.js';

export class GraphOntologySerializer implements GraphSerializerInterface {
  private readonly curie: CurieInterface;
  private readonly vocabularies: readonly VocabularyPluginInterface[];

  constructor(curie?: CurieInterface, vocabularies?: readonly VocabularyPluginInterface[]) {
    this.curie = curie ?? new Curie(DEFAULT_PREFIXES);
    this.vocabularies = vocabularies ?? [];
  }

  private findPluginForPredicate(predicate: string): undefined | VocabularyPluginInterface {
    // Check if this is a core OWL/RDFS predicate
    const corePredicates = new Set([
      'owl:AllDifferent',
      'owl:cardinality',
      'owl:Class',
      'owl:complementOf',
      'owl:DatatypeProperty',
      'owl:distinctMembers',
      'owl:hasValue',
      'owl:intersectionOf',
      'owl:maxCardinality',
      'owl:minCardinality',
      'owl:ObjectProperty',
      'owl:oneOf',
      'owl:onProperty',
      'owl:Restriction',
      'owl:unionOf',
      'rdf:first',
      'rdf:nil',
      'rdf:rest',
      'rdf:type',
      'rdf:value',
      'rdfs:comment',
      'rdfs:domain',
      'rdfs:label',
      'rdfs:range',
      'rdfs:subClassOf',
      'rdfs:subPropertyOf'
    ]);

    if (corePredicates.has(predicate)) {
      return undefined;
    }

    // Find plugin that owns this predicate
    for (const plugin of this.vocabularies) {
      if (Object.values(plugin.prefixes).some((prefix) => {
        return predicate.startsWith(prefix);
      })) {
        return plugin;
      }
    }

    return undefined;
  }

  /**
   * Serialize schema graphs into OWL JSON-LD nodes via quad projection and formatting.
   *
   * @param graphs - Schema graphs to serialize
   * @returns Array of OWL JSON-LD node objects
   */
  public serialize(graphs: readonly SchemaGraphInterface[]): unknown[] {
    resetBnodeCounter();
    const allQuads = graphs.flatMap((graph) => {
      return projectOwlGraph(graph, this.curie);
    });

    // Emit plugin quads for non-core predicates
    for (const graph of graphs) {
      const relations = graph.allRelations();

      for (const relation of relations) {
        const plugin = this.findPluginForPredicate(relation.predicate);

        if (plugin?.project) {
          plugin.project(relation, (quad) => {
            allQuads.push(quad);
          });
        }
      }
    }

    const nodes = quadsToJsonLd(allQuads);

    for (const node of nodes) {
      ensureArray(node, RDFS_SUB_CLASS_OF_IRI);
    }

    return nodes;
  }
}

function ensureArray(node: Record<string, unknown>, key: string): void {
  const value = node[key];

  if (value !== undefined && !Array.isArray(value)) {
    node[key] = [value];
  }
}
