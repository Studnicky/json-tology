import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphImpl.js';
import type { QuadInterface } from '../../interfaces/Quad.js';
import { projectShaclGraph } from '../rdf/shaclProjection.js';
import { BaseGraphSerializer } from './baseGraphSerializer.js';

const SHACL_CORE_PREDICATES: ReadonlySet<string> = new Set([
  'dash:readOnly',
  'dash:writeOnly',
  'rdfs:comment',
  'rdfs:domain',
  'rdfs:label',
  'rdfs:range',
  'sh:and',
  'sh:class',
  'sh:closed',
  'sh:datatype',
  'sh:description',
  'sh:hasValue',
  'sh:ignoredProperties',
  'sh:in',
  'sh:maxCount',
  'sh:maxExclusive',
  'sh:maxInclusive',
  'sh:maxLength',
  'sh:minCount',
  'sh:minExclusive',
  'sh:minInclusive',
  'sh:minLength',
  'sh:name',
  'sh:node',
  'sh:not',
  'sh:or',
  'sh:path',
  'sh:pattern',
  'sh:property',
  'sh:qualifiedMaxCount',
  'sh:qualifiedMinCount',
  'sh:qualifiedValueShape',
  'sh:targetClass',
  'sh:targetNode'
]);

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
