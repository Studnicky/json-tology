import type { CurieInterface } from '../interfaces/CurieInterface.js';
import type { IriMinterInterface } from '../interfaces/IriMinterInterface.js';
import type { AnnotationEmitModeType } from './AnnotationEmitModeType.js';
import type { QuadInterface } from '../interfaces/QuadInterface.js';
import type {
  DefaultGraph, NamedNode
} from '@rdfjs/types';
import type { LookupGraphFunctionType } from './LookupGraphFunctionType.js';
import type { PredicateResolverFunctionType } from './PredicateResolverFunctionType.js';
import type { QuadOptionsType } from './QuadOptionsType.js';
import type { SchemaGraphInterface } from '../interfaces/SchemaGraphInterface.js';

/**
 * Shared base arguments for ABox projection entry points.
 *
 * @remarks
 * Contains all stateful dependencies common to both instance-level and
 * property-level ABox projection. Concrete projection arg types compose this
 * base and add their own fields.
 *
 * @see {@link ProjectInstanceArgumentListType}
 * @see {@link ProjectPropertyArgumentListType}
 *
 * @category Projection
 * @since 0.22.0
 * @group ABox
 */
export type ProjectBaseArgumentListType = {
  'annotationEmitMode'?: AnnotationEmitModeType | undefined;
  'curie': CurieInterface | undefined;
  'depth': number;
  'graph': SchemaGraphInterface;
  'graphTerm': DefaultGraph | NamedNode;
  /** Optional cross-schema graph lookup — resolves full-IRI $ref to a foreign graph. */
  'lookupGraph'?: LookupGraphFunctionType | undefined;
  'minter': IriMinterInterface;
  'path': string;
  /** Single predicate-derivation authority — resolves each property's RDF predicate IRI. */
  'predicateResolver': PredicateResolverFunctionType;
  /** Pre-built `{ curie, graph: graphTerm }` — reused across all quads in this projection. */
  'quadOptions': QuadOptionsType;
  'quads': QuadInterface[];
  'visited': WeakSet<object>;
};
