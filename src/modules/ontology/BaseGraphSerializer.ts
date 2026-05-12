import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphImpl.js';
import type { GraphSerializerInterface } from '../../interfaces/Serializer.js';
import type { CurieInterface } from '../../interfaces/Curie.js';
import type { VocabularyPluginInterface } from '../../interfaces/VocabularyPlugin.js';
import type { QuadInterface } from '../../interfaces/Quad.js';
import { quadsToJsonLd } from '../rdf/JsonLdFormatter.js';
import { QuadFactory } from '../rdf/QuadFactory.js';
import { Curie } from '../rdf/Curie.js';
import { DEFAULT_PREFIXES } from '../../constants/PREFIXES.js';

export abstract class BaseGraphSerializer implements GraphSerializerInterface {
  /**
   * Ensures the value at `key` in `node` is wrapped in an array.
   * No-op if the value is undefined or already an array.
   */
  public static ensureArray(node: Record<string, unknown>, key: string): void {
    const value = node[key];

    if (value !== undefined && !Array.isArray(value)) {
      node[key] = [value];
    }
  }

  /**
   * Recursively traverses `node` and ensures that values at any of
   * the given `keys` are wrapped in arrays.
   */
  public static normalizeArrays(node: unknown, keys: readonly string[]): void {
    if (typeof node !== 'object' || node === null) {
      return;
    }

    if (Array.isArray(node)) {
      for (const item of node) {
        BaseGraphSerializer.normalizeArrays(item, keys);
      }

      return;
    }

    const obj = node as Record<string, unknown>;

    for (const key of keys) {
      if (obj[key] !== undefined && !Array.isArray(obj[key])) {
        obj[key] = [obj[key]];
      }
    }

    for (const value of Object.values(obj)) {
      BaseGraphSerializer.normalizeArrays(value, keys);
    }
  }

  protected readonly curie: CurieInterface;
  protected readonly vocabularies: readonly VocabularyPluginInterface[];

  public constructor(options?: { 'curie'?: CurieInterface;
    'vocabularies'?: readonly VocabularyPluginInterface[] }) {
    this.curie = options?.curie ?? new Curie(DEFAULT_PREFIXES);
    this.vocabularies = options?.vocabularies ?? [];
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
    QuadFactory.resetBnodeCounter();
    const allQuads = graphs.flatMap((graph) => {
      return this.projectGraph(graph);
    });

    // Emit plugin quads for non-core predicates
    for (const graph of graphs) {
      const relations = graph.allRelations();

      for (const relation of relations) {
        const plugin = this.findPluginForPredicate(relation.predicate);

        if (plugin?.project) {
          plugin.project(relation, (emittedQuad) => {
            allQuads.push(emittedQuad);
          });
        }
      }
    }

    const nodes = quadsToJsonLd(allQuads);

    this.postProcessNodes(nodes);

    return nodes;
  }
}
