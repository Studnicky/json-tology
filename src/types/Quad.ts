/**
 * RDF term types — canonical types from `@rdfjs/types`.
 *
 * Every internal and public quad in the project is a `Quad` from `@rdfjs/types`,
 * built directly from `NamedNode`, `BlankNode`, `Literal`, and `DefaultGraph`.
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
 * Union of every term type used by the project. Aligned with the rdf/js spec:
 * `Term = NamedNode | BlankNode | Literal | DefaultGraph` (the project does
 * not use `Variable`).
 */
export type TermType = BlankNode | DefaultGraph | Literal | NamedNode;

/**
 * Object-position term type for a quad. Aligned with the rdf/js spec
 * `Quad_Object = NamedNode | Literal | BlankNode` (no `Variable`).
 */
export type QuadObjectType = BlankNode | Literal | NamedNode;
