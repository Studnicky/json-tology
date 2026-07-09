import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphInterface.js';
import type { QuadInterface } from '../../interfaces/QuadInterface.js';
import { OwlProjection } from '../rdf/OwlProjection.js';
import type { IdentifierIssuerInterface } from '../../interfaces/IdentifierIssuerInterface.js';
import { OWL_CORE_PREDICATES } from '../../constants/ONTOLOGY_PREDICATES.js';
import { BaseGraphSerializer } from './BaseGraphSerializer.js';

export class GraphOntologySerializer extends BaseGraphSerializer {
  protected corePredicates(): ReadonlySet<string> {
    const result = OWL_CORE_PREDICATES;

    return result;
  }

  protected projectGraph(graph: SchemaGraphInterface, issuer?: IdentifierIssuerInterface): QuadInterface[] {
    const result = OwlProjection.graph(graph, {
      'curie': this.curie,
      issuer,
      'predicateResolver': this.predicateResolver
    });

    return result;
  }
}
