import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphImpl.js';
import type { GraphSerializerInterface } from '../../interfaces/Serializer.js';
import type { CurieInterface } from '../../interfaces/Curie.js';
import type { VocabularyPluginInterface } from '../../interfaces/VocabularyPlugin.js';
import type { QuadInterface } from '../../interfaces/Quad.js';
import { quadsToJsonLd } from '../rdf/jsonLdFormatter.js';
import { resetBnodeCounter } from '../rdf/Projection.js';
import { Curie } from '../rdf/curie.js';
import { DEFAULT_PREFIXES } from '../../constants/PREFIXES.js';

export abstract class BaseGraphSerializer implements GraphSerializerInterface {
  protected readonly curie: CurieInterface;
  protected readonly vocabularies: readonly VocabularyPluginInterface[];

  public constructor(curie?: CurieInterface, vocabularies?: readonly VocabularyPluginInterface[]) {
    this.curie = curie ?? new Curie(DEFAULT_PREFIXES);
    this.vocabularies = vocabularies ?? [];
  }

  protected abstract corePredicates(): ReadonlySet<string>;

  protected findPluginForPredicate(predicate: string): undefined | VocabularyPluginInterface {
    if (this.corePredicates().has(predicate)) {
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

  protected abstract postProcessNodes(nodes: Array<Record<string, unknown>>): void;

  protected abstract projectGraph(graph: SchemaGraphInterface): QuadInterface[];

  public serialize(graphs: readonly SchemaGraphInterface[]): unknown[] {
    resetBnodeCounter();
    const allQuads = graphs.flatMap((graph) => {
      return this.projectGraph(graph);
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

    this.postProcessNodes(nodes);

    return nodes;
  }
}
