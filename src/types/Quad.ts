/**
 * RDF term types — structurally compatible with @rdfjs/types.
 *
 * All term types carry an `equals(other: TermType): boolean` method per the
 * rdf/js Term contract (https://rdf.js.org/data-model-spec/#term-interface).
 *
 * Project-specific divergence:
 * - LiteralTermType.value is `unknown` (not `string`) — json-tology stores raw
 *   JS values (number, boolean, etc.) rather than serialised strings. External
 *   RDF/JS consumers must coerce via `String(literal.value)` at the boundary.
 * - ListTermType — project extension for RDF list shorthand; no @rdfjs equivalent.
 */

export type TermType = BnodeTermType | DefaultGraphTermType | IriTermType | ListTermType | LiteralTermType;

export interface IriTermType {
  equals(other: null | TermType): boolean;
  'termType': 'NamedNode';
  'value': string;
}

export interface BnodeTermType {
  equals(other: null | TermType): boolean;
  'termType': 'BlankNode';
  'value': string;
}

export interface LiteralTermType {
  'datatype': IriTermType;
  equals(other: null | TermType): boolean;
  'language': string;
  'termType': 'Literal';
  /**
   * Project widening: stores raw JS values (number, boolean, object, etc.)
   * rather than serialised strings. External RDF/JS consumers must coerce via
   * `String(literal.value)` at the boundary.
   */
  'value': unknown;
}

/**
 * DefaultGraph term — represents the default graph per the rdf/js spec.
 * Always has termType 'DefaultGraph' and value ''.
 */
export interface DefaultGraphTermType {
  equals(other: null | TermType): boolean;
  'termType': 'DefaultGraph';
  'value': '';
}

/**
 * ListTermType — project extension for RDF list shorthand.
 * Not part of the rdf/js spec; used internally for owl:unionOf / sh:or list encoding.
 */
export interface ListTermType {
  equals(other: null | TermType): boolean;
  'items': QuadObjectType[];
  'termType': 'List';
}

export type QuadObjectType = BnodeTermType | IriTermType | ListTermType | LiteralTermType;
