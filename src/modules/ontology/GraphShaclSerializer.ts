import type { SchemaGraph } from '../graph/SchemaGraph.js';
import { projectShaclGraph } from '../rdf/ShaclProjection.js';
import { quadsToJsonLd } from '../rdf/JsonLdFormatter.js';
import { resetBnodeCounter } from '../rdf/Projection.js';

export class GraphShaclSerializer {
  public serialize(graphs: readonly SchemaGraph[]): unknown[] {
    resetBnodeCounter();
    const allQuads = graphs.flatMap((g) => {
      return projectShaclGraph(g);
    });
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
  if (obj['sh:property'] !== undefined && !Array.isArray(obj['sh:property'])) {
    obj['sh:property'] = [obj['sh:property']];
  }

  for (const value of Object.values(obj)) {
    normalizeArrays(value);
  }
}
