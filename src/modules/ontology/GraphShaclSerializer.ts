import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphInterface.js';
import type { QuadInterface } from '../../interfaces/QuadInterface.js';
import { ShaclProjection } from '../rdf/ShaclProjection.js';
import type { IdentifierIssuerInterface } from '../../interfaces/IdentifierIssuerInterface.js';
import { SHACL_CORE_PREDICATES } from '../../constants/ONTOLOGY_PREDICATES.js';
import { BaseGraphSerializer } from './BaseGraphSerializer.js';

export class GraphShaclSerializer extends BaseGraphSerializer {
  protected corePredicates(): ReadonlySet<string> {
    const result = SHACL_CORE_PREDICATES;

    return result;
  }

  protected projectGraph(graph: SchemaGraphInterface, issuer?: IdentifierIssuerInterface): QuadInterface[] {
    const result = ShaclProjection.graph(graph, {
      'curie': this.curie,
      issuer,
      'predicateResolver': this.predicateResolver
    });

    return result;
  }
}
