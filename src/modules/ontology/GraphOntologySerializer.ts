import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphImpl.js';
import type { QuadInterface } from '../../interfaces/Quad.js';
import { projectOwlGraph } from '../rdf/owlProjection.js';
import { RDFS_SUB_CLASS_OF_IRI } from '../../constants/PREFIXES.js';
import { BaseGraphSerializer } from './baseGraphSerializer.js';

const OWL_CORE_PREDICATES: ReadonlySet<string> = new Set([
  'owl:AllDifferent',
  'owl:cardinality',
  'owl:Class',
  'owl:complementOf',
  'owl:DatatypeProperty',
  'owl:distinctMembers',
  'owl:hasValue',
  'owl:intersectionOf',
  'owl:maxCardinality',
  'owl:minCardinality',
  'owl:ObjectProperty',
  'owl:oneOf',
  'owl:onProperty',
  'owl:Restriction',
  'owl:unionOf',
  'rdf:first',
  'rdf:nil',
  'rdf:rest',
  'rdf:type',
  'rdf:value',
  'rdfs:comment',
  'rdfs:domain',
  'rdfs:label',
  'rdfs:range',
  'rdfs:subClassOf',
  'rdfs:subPropertyOf'
]);

export class GraphOntologySerializer extends BaseGraphSerializer {
  protected corePredicates(): ReadonlySet<string> {
    return OWL_CORE_PREDICATES;
  }

  protected postProcessNodes(nodes: Array<Record<string, unknown>>): void {
    for (const node of nodes) {
      ensureArray(node, RDFS_SUB_CLASS_OF_IRI);
    }
  }

  protected projectGraph(graph: SchemaGraphInterface): QuadInterface[] {
    return projectOwlGraph(graph, this.curie);
  }
}

function ensureArray(node: Record<string, unknown>, key: string): void {
  const value = node[key];

  if (value !== undefined && !Array.isArray(value)) {
    node[key] = [value];
  }
}
