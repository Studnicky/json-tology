import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphImpl.js';
import type { GraphSerializerInterface } from '../../interfaces/Serializer.js';
import type { CurieInterface } from '../../interfaces/Curie.js';
import type { VocabularyPluginInterface } from '../../interfaces/VocabularyPlugin.js';
import { projectShaclGraph } from '../rdf/shaclProjection.js';
import { quadsToJsonLd } from '../rdf/jsonLdFormatter.js';
import { resetBnodeCounter } from '../rdf/projection.js';
import { Curie } from '../rdf/curie.js';
import { DEFAULT_PREFIXES } from '../../constants/PREFIXES.js';

export class GraphShaclSerializer implements GraphSerializerInterface {
  private readonly curie: CurieInterface;
  private readonly vocabularies: readonly VocabularyPluginInterface[];

  constructor(curie?: CurieInterface, vocabularies?: readonly VocabularyPluginInterface[]) {
    this.curie = curie ?? new Curie(DEFAULT_PREFIXES);
    this.vocabularies = vocabularies ?? [];
  }

  private findPluginForPredicate(predicate: string): undefined | VocabularyPluginInterface {
    // Check if this is a core SHACL predicate
    const corePredicates = new Set([
      'dash:readOnly',
      'dash:writeOnly',
      'rdfs:comment',
      'rdfs:domain',
      'rdfs:label',
      'rdfs:range',
      'sh:and',
      'sh:class',
      'sh:closed',
      'sh:datatype',
      'sh:description',
      'sh:hasValue',
      'sh:ignoredProperties',
      'sh:in',
      'sh:maxCount',
      'sh:maxExclusive',
      'sh:maxInclusive',
      'sh:maxLength',
      'sh:minCount',
      'sh:minExclusive',
      'sh:minInclusive',
      'sh:minLength',
      'sh:name',
      'sh:node',
      'sh:not',
      'sh:or',
      'sh:path',
      'sh:pattern',
      'sh:property',
      'sh:qualifiedMaxCount',
      'sh:qualifiedMinCount',
      'sh:qualifiedValueShape',
      'sh:targetClass',
      'sh:targetNode'
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
   * Serialize schema graphs into SHACL JSON-LD nodes via quad projection and formatting.
   *
   * @param graphs - Schema graphs to serialize
   * @returns Array of SHACL JSON-LD node objects
   */
  public serialize(graphs: readonly SchemaGraphInterface[]): unknown[] {
    resetBnodeCounter();
    const allQuads = graphs.flatMap((graph) => {
      return projectShaclGraph(graph, this.curie);
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
      normalizeArrays(node);
    }

    return nodes;
  }
}

function normalizeArrays(node: unknown): void {
  if (typeof node !== 'object' || node === null) {
    return;
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      normalizeArrays(item);
    }

    return;
  }

  const obj = node as Record<string, unknown>;

  // sh:property must always be an array
  // Check both CURIE form and expanded IRI form
  const propKey = 'http://www.w3.org/ns/shacl#property';

  if (obj[propKey] !== undefined && !Array.isArray(obj[propKey])) {
    obj[propKey] = [obj[propKey]];
  }

  for (const value of Object.values(obj)) {
    normalizeArrays(value);
  }
}
