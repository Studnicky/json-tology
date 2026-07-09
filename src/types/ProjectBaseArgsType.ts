import type { CurieInterface } from '../interfaces/CurieInterface.js';
import type { IriMinterInterface } from '../interfaces/IriMinterInterface.js';
import type { AnnotationEmitModeType } from './AnnotationEmitModeType.js';
import type { QuadInterface } from '../interfaces/QuadInterface.js';
import type {
  DefaultGraph, NamedNode
} from '@rdfjs/types';
import type { LookupGraphFnType } from './LookupGraphFnType.js';
import type { PredicateResolverFnType } from './PredicateResolverFnType.js';
import type { QuadOptsType } from './QuadOptsType.js';
import type { SchemaGraphInterface } from '../interfaces/SchemaGraphInterface.js';

/**
 * Shared base arguments for ABox projection entry points.
 *
 * @remarks
 * Contains all stateful dependencies common to both instance-level and
 * property-level ABox projection. Concrete projection arg types compose this
 * base and add their own fields.
 *
 * @see {@link ProjectInstanceArgsType}
 * @see {@link ProjectPropertyArgsType}
 *
 * @category Projection
 * @since 0.22.0
 * @group ABox
 */
export type ProjectBaseArgsType = {
  'annotationEmitMode'?: AnnotationEmitModeType | undefined;
  'curie': CurieInterface | undefined;
  'depth': number;
  'graph': SchemaGraphInterface;
  'graphTerm': DefaultGraph | NamedNode;
  /** Optional cross-schema graph lookup — resolves full-IRI $ref to a foreign graph. */
  'lookupGraph'?: LookupGraphFnType | undefined;
  'minter': IriMinterInterface;
  'path': string;
  /** Single predicate-derivation authority — resolves each property's RDF predicate IRI. */
  'predicateResolver': PredicateResolverFnType;
  /** Pre-built `{ curie, graph: graphTerm }` — reused across all quads in this projection. */
  'quadOpts': QuadOptsType;
  'quads': QuadInterface[];
  'visited': WeakSet<object>;
};
