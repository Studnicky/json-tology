/**
 * RDF term types — structurally compatible with `@rdfjs/types`.
 *
 * `IriTermType`, `BnodeTermType`, and `DefaultGraphTermType` are structurally
 * identical to `@rdfjs/types#NamedNode`, `BlankNode`, and `DefaultGraph`
 * respectively. Instances produced by the `Terms` factory are assignable to
 * the corresponding rdf/js interfaces at runtime.
 *
 * `LiteralTermType` is a project-specific extension: it widens `value` to
 * `unknown` so that the internal Terms factory can store raw JS values (number,
 * boolean, etc.) without pre-serialisation. The `datatype` and `language`
 * fields follow the rdf/js spec exactly. External RDF/JS consumers must
 * coerce via `String(literal.value)` at the boundary.
 *
 * `ListTermType` is a project extension for RDF list shorthand
 * (owl:unionOf / sh:or). It has no equivalent in the rdf/js spec.
 *
 * All term types carry an `equals(other)` method per the rdf/js Term contract
 * (https://rdf.js.org/data-model-spec/#term-interface).
 *
 * @see {@link https://rdf.js.org/data-model-spec/ rdf/js Data Model Spec}
 * @see {@link https://www.npmjs.com/package/@rdfjs/types @rdfjs/types} — types-only
 *   package now in `dependencies` so consumers can import and use alongside this package.
 */

export type TermType = BnodeTermType | DefaultGraphTermType | IriTermType | ListTermType | LiteralTermType;

/**
 * IriTermType — represents an IRI resource (NamedNode in rdf/js terminology).
 *
 * Structurally identical to `@rdfjs/types#NamedNode`. Instances produced by
 * `Terms.iri()` satisfy the `NamedNode` interface at runtime.
 */
export interface IriTermType {
  equals(other: null | TermType | undefined): boolean;
  'termType': 'NamedNode';
  'value': string;
}

/**
 * BnodeTermType — represents an RDF blank node.
 *
 * Structurally identical to `@rdfjs/types#BlankNode`. Instances produced by
 * `Terms.blank()` satisfy the `BlankNode` interface at runtime.
 */
export interface BnodeTermType {
  equals(other: null | TermType | undefined): boolean;
  'termType': 'BlankNode';
  'value': string;
}

/**
 * LiteralTermType — project-owned literal term with widened `value: unknown`.
 *
 * Structurally similar to `@rdfjs/types#Literal` but widens `value` from
 * `string` to `unknown` to accommodate raw JS numbers, booleans, and structured
 * values stored internally without pre-serialisation. The `datatype` and
 * `language` fields follow the rdf/js spec exactly.
 *
 * Divergence from `@rdfjs/types#Literal`:
 * - `value: unknown` (not `string`) — raw JS values stored as-is.
 *   External RDF/JS consumers must coerce via `String(literal.value)`.
 * - `equals` compares serialised string forms via `String(self.value)`.
 */
export interface LiteralTermType {
  'datatype': IriTermType;
  equals(other: null | TermType | undefined): boolean;
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
 * DefaultGraphTermType — represents the default graph.
 *
 * Structurally identical to `@rdfjs/types#DefaultGraph`. The singleton
 * instance produced by `Terms.defaultGraph()` satisfies the `DefaultGraph`
 * interface at runtime.
 */
export interface DefaultGraphTermType {
  equals(other: null | TermType | undefined): boolean;
  'termType': 'DefaultGraph';
  'value': '';
}

/**
 * ListTermType — project extension for RDF list shorthand.
 *
 * Used internally for owl:unionOf / sh:or list encoding. Not part of the
 * rdf/js spec; has no `@rdfjs/types` equivalent. Consumers piping quads
 * into standard rdf/js ecosystem tools should expand lists first.
 */
export interface ListTermType {
  equals(other: null | TermType | undefined): boolean;
  'items': QuadObjectType[];
  'termType': 'List';
}

export type QuadObjectType = BnodeTermType | IriTermType | ListTermType | LiteralTermType;
