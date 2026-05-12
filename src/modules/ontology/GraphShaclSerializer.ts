import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphImpl.js';
import type { QuadInterface } from '../../interfaces/Quad.js';
import { ShaclProjection } from '../rdf/ShaclProjection.js';
import { SHACL_CORE_PREDICATES } from '../../constants/ONTOLOGY_PREDICATES.js';
import { BaseGraphSerializer } from './BaseGraphSerializer.js';
import { SH } from '../../constants/IRI.js';

const SHACL_ARRAY_KEYS = [SH.PROPERTY_IRI] as const;

export class GraphShaclSerializer extends BaseGraphSerializer {
  protected corePredicates(): ReadonlySet<string> {
    return SHACL_CORE_PREDICATES;
  }

  protected postProcessNodes(nodes: Array<Record<string, unknown>>): void {
    for (const node of nodes) {
      BaseGraphSerializer.normalizeArrays(node, SHACL_ARRAY_KEYS);
    }
  }

  protected projectGraph(graph: SchemaGraphInterface): QuadInterface[] {
    return ShaclProjection.graph(graph, { 'curie': this.curie });
  }
}
