import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphImpl.js';
import type { GraphSerializerInterface } from '../../interfaces/Serializer.js';
import type { CurieInterface } from '../../interfaces/Curie.js';
import type { VocabularyPluginInterface } from '../../interfaces/VocabularyPlugin.js';
import type { QuadInterface } from '../../interfaces/Quad.js';
import type { PredicateResolverFnType } from '../../types/PredicateResolverFn.js';
import { Curie } from '../rdf/Curie.js';
import { IdentifierIssuer } from '../rdf/IdentifierIssuer.js';
import type { IdentifierIssuerInterface } from '../../interfaces/IdentifierIssuer.js';
import { STANDARD_PREFIXES } from '../../constants/STANDARD_PREFIXES.js';

/**
 * Abstract base class for graph-to-RDF serializers.
 *
 * Provides shared utilities (`ensureArray`, `normalizeArrays`), common
 * constructor wiring (Curie, predicateResolver, vocabulary plugins), and the
 * `serializeQuads` orchestration method. Subclasses implement `projectGraph`
 * and `corePredicates`.
 *
 * @remarks
 * The `serializeQuads` method calls `projectGraph` for each input graph to
 * produce core quads, then iterates over relations to emit plugin quads for
 * predicates not owned by the core vocabulary. Vocabulary plugins are matched
 * by IRI prefix against their declared `prefixes` map.
 *
 * @example
 * ```ts
 * class MySerializer extends BaseGraphSerializer {
 *   protected corePredicates() { return new Set(['rdf:type']); }
 *   protected projectGraph(graph, issuer) { return []; }
 * }
 * ```
 *
 * @category Serializer
 * @since 0.12.0
 * @see {@link GraphSerializerInterface}
 * @group Ontology
 */
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

  /** Lazily-memoized result of corePredicates() — populated on first findPluginForPredicate call. */
  #corePredicatesCache: ReadonlySet<string> | undefined;
  /**
   * Flat list of {plugin, prefix} pairs built from all vocabulary plugins.
   * Computed once on first findPluginForPredicate call; avoids Object.values()
   * allocations per relation during serializeQuads.
   */
  #pluginPrefixEntries: Array<{ 'plugin': VocabularyPluginInterface;
    'prefix': string }> | undefined;
  protected readonly curie: CurieInterface;

  protected readonly predicateResolver: PredicateResolverFnType | undefined;

  protected readonly vocabularies: readonly VocabularyPluginInterface[];

  public constructor(options?: { 'curie'?: CurieInterface;
    'predicateResolver'?: PredicateResolverFnType | undefined;
    'vocabularies'?: readonly VocabularyPluginInterface[] }) {
    this.curie = options?.curie ?? new Curie({ ...STANDARD_PREFIXES });
    this.predicateResolver = options?.predicateResolver;
    this.vocabularies = options?.vocabularies ?? [];
  }

  protected abstract corePredicates(): ReadonlySet<string>;

  protected findPluginForPredicate(predicate: string): undefined | VocabularyPluginInterface {
    // Lazily memoize corePredicates — abstract method resolved after super() completes.
    if (this.#corePredicatesCache === undefined) {
      this.#corePredicatesCache = this.corePredicates();
    }

    if (this.#corePredicatesCache.has(predicate)) {
      return undefined;
    }

    // Build flat prefix list once; avoids Object.values() allocation per relation.
    if (this.#pluginPrefixEntries === undefined) {
      this.#pluginPrefixEntries = [];

      for (const plugin of this.vocabularies) {
        for (const prefix of Object.values(plugin.prefixes)) {
          this.#pluginPrefixEntries.push({
            plugin,
            prefix
          });
        }
      }
    }

    // Find plugin that owns this predicate
    for (const entry of this.#pluginPrefixEntries) {
      if (predicate.startsWith(entry.prefix)) {
        return entry.plugin;
      }
    }

    return undefined;
  }

  protected abstract projectGraph(graph: SchemaGraphInterface, issuer?: IdentifierIssuerInterface): QuadInterface[];

  public serializeQuads(graphs: readonly SchemaGraphInterface[]): QuadInterface[] {
    const issuer = new IdentifierIssuer();
    const allQuads = graphs.flatMap((graph: SchemaGraphInterface): QuadInterface[] => {
      return this.projectGraph(graph, issuer);
    });

    // Emit plugin quads for non-core predicates
    for (const graph of graphs) {
      const relations = graph.allRelations();

      for (const relation of relations) {
        const plugin = this.findPluginForPredicate(relation.predicate);

        if (plugin?.project) {
          plugin.project(relation, (emittedQuad: QuadInterface): void => {
            allQuads.push(emittedQuad);
          });
        }
      }
    }

    return allQuads;
  }
}
