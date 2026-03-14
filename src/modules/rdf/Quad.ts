/**
 * Quad — lightweight RDF quad model for TBox and ABox projection.
 *
 * Represents a single RDF statement with subject, predicate, object,
 * and optional named graph.
 */

export type QuadObjectType
  = | { 'datatype': string
    'type': 'literal';
    'value': unknown; }
  | { 'id': string
    'type': 'bnode'; }
  | { 'items': QuadObjectType[]
    'type': 'list'; }
  | { 'type': 'iri';
    'value': string };

export interface QuadInterface {
  'graph'?: string;
  'object': QuadObjectType;
  'predicate': string;
  'subject': string;
}
