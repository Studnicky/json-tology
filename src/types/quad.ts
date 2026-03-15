/**
 * RDF term types — structurally compatible with @rdfjs/types (minus equals()).
 *
 * - IriTermType     ≈ Omit<NamedNode, 'equals'>
 * - BnodeTermType   ≈ Omit<BlankNode, 'equals'>
 * - LiteralTermType — wider than @rdfjs Literal (value: unknown, not string)
 * - ListTermType    — project extension for RDF list shorthand (no @rdfjs equivalent)
 */

export interface IriTermType {
  'termType': 'NamedNode';
  'value': string;
}

export interface BnodeTermType {
  'termType': 'BlankNode';
  'value': string;
}

export interface LiteralTermType {
  'datatype': IriTermType;
  'language': string;
  'termType': 'Literal';
  'value': unknown;
}

export interface ListTermType {
  'items': QuadObjectType[];
  'termType': 'List';
}

export type QuadObjectType = BnodeTermType | IriTermType | ListTermType | LiteralTermType;
