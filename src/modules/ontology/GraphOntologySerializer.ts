import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphImpl.js';
import type { QuadInterface } from '../../interfaces/Quad.js';
import { OwlProjection } from '../rdf/OwlProjection.js';
import type { IdentifierIssuerInterface } from '../../interfaces/IdentifierIssuer.js';
import { OWL_CORE_PREDICATES } from '../../constants/ONTOLOGY_PREDICATES.js';
import { BaseGraphSerializer } from './BaseGraphSerializer.js';

export class GraphOntologySerializer extends BaseGraphSerializer {
  protected corePredicates(): ReadonlySet<string> {
    return OWL_CORE_PREDICATES;
  }

  protected projectGraph(graph: SchemaGraphInterface, issuer?: IdentifierIssuerInterface): QuadInterface[] {
    return OwlProjection.graph(graph, {
      'curie': this.curie,
      issuer,
      'predicateResolver': this.predicateResolver
    });
  }
}
