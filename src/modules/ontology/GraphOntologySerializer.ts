import type { SchemaGraph } from '../graph/SchemaGraph.js';
import { projectOwlGraph } from '../rdf/OwlProjection.js';
import { quadsToJsonLd } from '../rdf/JsonLdFormatter.js';
import { resetBnodeCounter } from '../rdf/Projection.js';

export class GraphOntologySerializer {
  public serialize(graphs: readonly SchemaGraph[]): unknown[] {
    resetBnodeCounter();
    const allQuads = graphs.flatMap((g) => {
      return projectOwlGraph(g);
    });
    const nodes = quadsToJsonLd(allQuads);

    for (const node of nodes) {
      ensureArray(node, 'rdfs:subClassOf');
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
