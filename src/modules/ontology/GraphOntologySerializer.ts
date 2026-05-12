import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphImpl.js';
import type { QuadInterface } from '../../interfaces/Quad.js';
import { OwlProjection } from '../rdf/OwlProjection.js';
import { RDFS_SUB_CLASS_OF_IRI } from '../../constants/PREFIXES.js';
import { OWL_CORE_PREDICATES } from '../../constants/ONTOLOGY_PREDICATES.js';
import { BaseGraphSerializer } from './BaseGraphSerializer.js';

export class GraphOntologySerializer extends BaseGraphSerializer {
  protected corePredicates(): ReadonlySet<string> {
    return OWL_CORE_PREDICATES;
  }

  protected postProcessNodes(nodes: Array<Record<string, unknown>>): void {
    for (const node of nodes) {
      BaseGraphSerializer.ensureArray(node, RDFS_SUB_CLASS_OF_IRI);
    }
  }

  protected projectGraph(graph: SchemaGraphInterface): QuadInterface[] {
    return OwlProjection.graph(graph, { 'curie': this.curie });
  }
}
