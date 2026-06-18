/**
 * RDF term types — canonical re-exports from `@rdfjs/types`.
 *
 * The project's term types ARE the rdf/js spec types:
 *
 *  - `IriTermType`           = `@rdfjs/types#NamedNode`
 *  - `BnodeTermType`         = `@rdfjs/types#BlankNode`
 *  - `LiteralTermType`       = `@rdfjs/types#Literal`        (`value: string`)
 *  - `DefaultGraphTermType`  = `@rdfjs/types#DefaultGraph`
 *
 * Every internal and public quad in the project is a `Quad` from `@rdfjs/types`.
 * There is NO project-internal quad shape. RDF lists (used by `owl:unionOf`,
 * `sh:or`, `sh:in`, `sh:and`, etc.) are emitted as standard
 * `rdf:first` / `rdf:rest` / `rdf:nil` triple sequences by `src/modules/rdf/Lists.ts`
 * at the point of construction — no intermediate list-term representation.
 *
 * Literal values are typed as `string` per the rdf/js spec, with the JS type
 * tag carried in `.datatype.value`. To decode back to a typed JS value
 * (number, boolean, Date), use `Terms.decodeLiteral` from
 * `src/modules/quads/Terms.ts` — `fromQuads` and the internal Lift pipeline
 * call it automatically.
 *
 * @see {@link https://rdf.js.org/data-model-spec/ rdf/js Data Model Spec}
 */

import type {
  BlankNode, DefaultGraph, Literal, NamedNode
} from '@rdfjs/types';

/**
 * IriTermType — canonical alias of `@rdfjs/types#NamedNode`.
 * Represents an IRI resource in an RDF quad.
 */
export type IriTermType = NamedNode;

/**
 * BnodeTermType — canonical alias of `@rdfjs/types#BlankNode`.
 * Represents a blank node in an RDF quad.
 */
export type BnodeTermType = BlankNode;

/**
 * LiteralTermType — canonical alias of `@rdfjs/types#Literal`.
 *
 * Per the rdf/js spec, `value` is `string`. The JS type tag is carried in
 * `datatype.value` (e.g. `xsd:integer`, `xsd:boolean`, `xsd:dateTime`).
 *
 * To decode back to a typed JS value, use `Terms.decodeLiteral(literal)` from
 * `src/modules/quads/Terms.ts` — `fromQuads` and the internal Lift pipeline
 * call it automatically.
 */
export type LiteralTermType = Literal;

/**
 * DefaultGraphTermType — canonical alias of `@rdfjs/types#DefaultGraph`.
 * Represents the default graph position in an RDF quad.
 */
export type DefaultGraphTermType = DefaultGraph;

/**
 * Union of every term type used by the project. Aligned with the rdf/js spec:
 * `Term = NamedNode | BlankNode | Literal | DefaultGraph` (the project does
 * not use `Variable`).
 */
export type TermType = BnodeTermType | DefaultGraphTermType | IriTermType | LiteralTermType;

/**
 * Object-position term type for a quad. Aligned with the rdf/js spec
 * `Quad_Object = NamedNode | Literal | BlankNode` (no `Variable`).
 */
export type QuadObjectType = BnodeTermType | IriTermType | LiteralTermType;
