import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphImpl.js';
import type { QuadInterface } from '../../interfaces/Quad.js';
import { ShaclProjection } from '../rdf/ShaclProjection.js';
import type { IdentifierIssuerInterface } from '../../interfaces/IdentifierIssuer.js';
import { SHACL_CORE_PREDICATES } from '../../constants/ONTOLOGY_PREDICATES.js';
import { BaseGraphSerializer } from './BaseGraphSerializer.js';
import { SHACL_ARRAY_KEYS } from '../../constants/SHACL.js';

export class GraphShaclSerializer extends BaseGraphSerializer {
  protected corePredicates(): ReadonlySet<string> {
    return SHACL_CORE_PREDICATES;
  }

  protected postProcessNodes(nodes: Array<Record<string, unknown>>): void {
    for (const node of nodes) {
      BaseGraphSerializer.normalizeArrays(node, SHACL_ARRAY_KEYS);
    }
  }

  protected projectGraph(graph: SchemaGraphInterface, issuer?: IdentifierIssuerInterface): QuadInterface[] {
    return ShaclProjection.graph(graph, {
      'curie': this.curie,
      issuer
    });
  }
}
