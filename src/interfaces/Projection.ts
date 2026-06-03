import type { CurieInterface } from './Curie.js';
import type { QuadInterface } from './Quad.js';
import type {
  DefaultGraphTermType, IriTermType
} from '../types/Quad.js';
import type { PredicateResolverFnType } from '../types/PredicateResolverFn.js';
import type { SchemaGraphNodeInterface } from './SchemaGraph.js';
import type { SchemaGraphInterface } from './SchemaGraphImpl.js';

/**
 * Mints subject IRIs for RDF instances projected from JSON data values.
 *
 * @remarks
 * Implementations derive a stable IRI from the combination of class ID,
 * runtime value, JSON path, and recursion depth. The minted IRI is used as
 * the RDF subject for the projected ABox individual.
 *
 * @example
 * ```ts
 * const iri = minter.mint('https://example.com/User', data, '/users/0', 0);
 * ```
 *
 * @category Projection
 * @since 0.10.0
 * @see {@link ProjectInstanceArgs}
 * @group ABox
 */
export interface IriMinterInterface {
  mint(classId: string, value: unknown, path: string, depth: number): string;
}

/** Pre-built options object passed to QuadFactory.quad — avoids per-call allocation.
 *
 * @remarks
 * Constructed once per projection pass and reused across every quad emitted
 * within that pass. Carries the optional CURIE handler and the target named
 * graph term so callers do not re-derive them on every quad.
 *
 * @example
 * ```ts
 * const quadOpts: QuadOptsInterface = { curie, graph: graphTerm };
 * ```
 *
 * @category Projection
 * @since 0.10.0
 * @see {@link ProjectInstanceArgs}
 * @group ABox
 */
export interface QuadOptsInterface {
  readonly 'curie'?: CurieInterface | undefined;
  readonly 'graph'?: DefaultGraphTermType | IriTermType | undefined;
}

/**
 * Arguments passed to the instance-level ABox projection entry point.
 *
 * @remarks
 * Collects every stateful dependency needed to project a single JSON object
 * (one ABox individual) into a set of RDF quads. The `visited` WeakSet guards
 * against circular references; `lookupGraph` enables cross-schema $ref
 * resolution to foreign graphs.
 *
 * @example
 * ```ts
 * const args: ProjectInstanceArgs = {
 *   curie, data, depth: 0, graph, graphTerm, minter, node, path: '/',
 *   predicateResolver, quadOpts, quads: [], visited: new WeakSet(),
 * };
 * ```
 *
 * @category Projection
 * @since 0.10.0
 * @see {@link ProjectPropertyArgs}
 * @group ABox
 */
export interface ProjectInstanceArgs {
  readonly 'curie': CurieInterface | undefined;
  readonly 'data': Record<string, unknown>;
  readonly 'depth': number;
  readonly 'graph': SchemaGraphInterface;
  readonly 'graphTerm': DefaultGraphTermType | IriTermType;
  /** Optional cross-schema graph lookup — resolves full-IRI $ref to a foreign graph. */
  readonly 'lookupGraph'?: ((schemaId: string) => SchemaGraphInterface | undefined) | undefined;
  readonly 'minter': IriMinterInterface;
  readonly 'node': SchemaGraphNodeInterface;
  readonly 'path': string;
  /** Single predicate-derivation authority — resolves each property's RDF predicate IRI. */
  readonly 'predicateResolver': PredicateResolverFnType;
  /** Pre-built `{ curie, graph: graphTerm }` — reused across all quads in this projection. */
  readonly 'quadOpts': QuadOptsInterface;
  readonly 'quads': QuadInterface[];
  readonly 'visited': WeakSet<object>;
}

/**
 * Arguments passed to the property-level ABox projection entry point.
 *
 * @remarks
 * Carries the context needed to project a single property value of an ABox
 * individual into one or more RDF quads. The `propertySemantics` object
 * pre-computes format, iriRef, itemsNode, language, and schemaTypes so the
 * inner loop avoids repeated graph lookups. `lookupGraph` enables $ref
 * resolution across schema boundaries.
 *
 * @example
 * ```ts
 * const args: ProjectPropertyArgs = {
 *   curie, depth: 1, graph, graphTerm, instanceIri, minter, path: '/name',
 *   predicateResolver, propertyIRI, propertyNode, propertySemantics,
 *   quadOpts, quads, value, visited,
 * };
 * ```
 *
 * @category Projection
 * @since 0.10.0
 * @see {@link ProjectInstanceArgs}
 * @group ABox
 */
export interface ProjectPropertyArgs {
  readonly 'curie': CurieInterface | undefined;
  readonly 'depth': number;
  readonly 'graph': SchemaGraphInterface;
  readonly 'graphTerm': DefaultGraphTermType | IriTermType;
  readonly 'instanceIri': string;
  /** Optional cross-schema graph lookup — resolves full-IRI $ref to a foreign graph. */
  readonly 'lookupGraph'?: ((schemaId: string) => SchemaGraphInterface | undefined) | undefined;
  readonly 'minter': IriMinterInterface;
  readonly 'path': string;
  /** Single predicate-derivation authority — forwarded to the recursive nested-instance projection. */
  readonly 'predicateResolver': PredicateResolverFnType;
  readonly 'propertyIRI': string;
  readonly 'propertyNode': SchemaGraphNodeInterface;
  readonly 'propertySemantics': { 'format': string | undefined;
    'iriRef': boolean;
    'itemsNode': SchemaGraphNodeInterface | undefined;
    'language': string | undefined;
    'schemaTypes': string[] };
  /** Pre-built `{ curie, graph: graphTerm }` — reused across all quads in this projection. */
  readonly 'quadOpts': QuadOptsInterface;
  readonly 'quads': QuadInterface[];
  readonly 'value': unknown;
  readonly 'visited': WeakSet<object>;
}
