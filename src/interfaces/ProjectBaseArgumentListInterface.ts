import type { CurieInterface } from './CurieInterface.js';
import type { IriMinterInterface } from './IriMinterInterface.js';
import type { AnnotationEmitModeEntity } from '../entities/AnnotationEmitModeEntity.js';
import type { QuadInterface } from './QuadInterface.js';
import type {
  DefaultGraph, NamedNode
} from '@rdfjs/types';
import type { LookupGraphFunctionInterface } from './LookupGraphFunctionInterface.js';
import type { PredicateResolverInterface } from './PredicateResolverInterface.js';
import type { QuadOptionsInterface } from './QuadOptionsInterface.js';
import type { SchemaGraphInterface } from './SchemaGraphInterface.js';
import type { NumberValueEntity } from '../entities/NumberValueEntity.js';
import type { StringValueEntity } from '../entities/StringValueEntity.js';

/**
 * Shared base arguments for ABox projection entry points.
 *
 * @remarks
 * Contains all stateful dependencies common to both instance-level and
 * property-level ABox projection. Concrete projection arg types compose this
 * base and add their own fields.
 *
 * @see {@link ProjectInstanceArgumentListInterface}
 * @see {@link ProjectPropertyArgumentListInterface}
 *
 * @category Projection
 * @since 0.22.0
 * @group ABox
 */
export interface ProjectBaseArgumentListInterface {
  'annotationEmitMode'?: AnnotationEmitModeEntity.Type | undefined;
  'curie': CurieInterface | undefined;
  'depth': NumberValueEntity.Type;
  'graph': SchemaGraphInterface;
  'graphTerm': DefaultGraph | NamedNode;
  /** Optional cross-schema graph lookup — resolves full-IRI $ref to a foreign graph. */
  'lookupGraph'?: LookupGraphFunctionInterface | undefined;
  'minter': IriMinterInterface;
  'path': StringValueEntity.Type;
  /** Single predicate-derivation authority — resolves each property's RDF predicate IRI. */
  'predicateResolver': PredicateResolverInterface;
  /** Pre-built `{ curie, graph: graphTerm }` — reused across all quads in this projection. */
  'quadOptions': QuadOptionsInterface;
  'quads': QuadInterface[];
  'visited': WeakSet<object>;
}
