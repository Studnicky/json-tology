import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphImpl.js';
import type { QuadInterface } from '../../interfaces/Quad.js';
import { projectShaclGraph } from '../rdf/shaclProjection.js';
import { SHACL_CORE_PREDICATES } from '../../constants/ONTOLOGY_PREDICATES.js';
import { BaseGraphSerializer } from './baseGraphSerializer.js';

export class GraphShaclSerializer extends BaseGraphSerializer {
  protected corePredicates(): ReadonlySet<string> {
    return SHACL_CORE_PREDICATES;
  }

  protected postProcessNodes(nodes: Array<Record<string, unknown>>): void {
    for (const node of nodes) {
      normalizeArrays(node);
    }
  }

  protected projectGraph(graph: SchemaGraphInterface): QuadInterface[] {
    return projectShaclGraph(graph, this.curie);
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
