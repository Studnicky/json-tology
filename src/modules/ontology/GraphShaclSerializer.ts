import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphImpl.js';
import type { QuadInterface } from '../../interfaces/Quad.js';
import { projectShaclGraph } from '../rdf/ShaclProjection.js';
import { SHACL_CORE_PREDICATES } from '../../constants/ONTOLOGY_PREDICATES.js';
import { BaseGraphSerializer } from './baseGraphSerializer.js';
import { SH } from '../../constants/IRI.js';
import { normalizeArrays } from './serializerUtils.js';

const SHACL_ARRAY_KEYS = [SH.PROPERTY_IRI] as const;

export class GraphShaclSerializer extends BaseGraphSerializer {
  protected corePredicates(): ReadonlySet<string> {
    return SHACL_CORE_PREDICATES;
  }

  protected postProcessNodes(nodes: Array<Record<string, unknown>>): void {
    for (const node of nodes) {
      normalizeArrays(node, SHACL_ARRAY_KEYS);
    }
  }

  protected projectGraph(graph: SchemaGraphInterface): QuadInterface[] {
    return projectShaclGraph(graph, this.curie);
  }
}
