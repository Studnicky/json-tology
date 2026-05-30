import type { CurieInterface } from './Curie.js';
import type { QuadInterface } from './Quad.js';
import type {
  DefaultGraphTermType, IriTermType
} from '../types/Quad.js';
import type { PredicateResolverFnType } from '../types/PredicateResolverFn.js';
import type { SchemaGraphNodeInterface } from './SchemaGraph.js';
import type { SchemaGraphInterface } from './SchemaGraphImpl.js';

export interface IriMinterInterface {
  mint(classId: string, value: unknown, path: string, depth: number): string;
}

/** Pre-built options object passed to QuadFactory.quad — avoids per-call allocation. */
export interface QuadOptsInterface {
  readonly 'curie'?: CurieInterface | undefined;
  readonly 'graph'?: DefaultGraphTermType | IriTermType | undefined;
}

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
