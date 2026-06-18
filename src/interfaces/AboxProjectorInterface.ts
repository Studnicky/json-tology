import type { AnnotationEmitModeType } from '../types/AnnotationEmitModeType.js';
import type { CurieInterface } from './CurieInterface.js';
import type { QuadInterface } from './QuadInterface.js';
import type { SchemaGraphInterface } from './SchemaGraphInterface.js';
import type { SchemaGraphNodeType } from '../types/SchemaGraph.js';
import type { SkolemizeFnType } from '../types/SkolemizeFnType.js';
import type { PredicateResolverFnType } from '../types/PredicateResolverFnType.js';

/**
 * Behavioral contract for ABox projection — projecting validated instance data
 * into RDF quads against a canonical {@link SchemaGraphInterface}.
 *
 * @remarks
 * This contract exists to invert the materialization → rdf layering. The
 * `materialization` layer must not import `rdf/` directly; instead the facade
 * ({@link JsonTology}) injects the concrete `Projection` (which satisfies this
 * contract) into the {@link Materializer} via `MaterializerOptionsType`. The
 * `abox` signature is identical to `Projection.abox`.
 *
 * @category RDF
 * @group Projection
 */
export interface AboxProjectorInterface {
  abox(
    graph: SchemaGraphInterface,
    data: unknown,
    baseIri: string,
    options?: { 'annotationEmitMode'?: AnnotationEmitModeType | undefined;
      'curie'?: CurieInterface | undefined;
      'entryNode'?: SchemaGraphNodeType | undefined;
      'graphIri'?: string | undefined;
      'iriFor'?: SkolemizeFnType | undefined;
      'lookupGraph'?: ((schemaId: string) => SchemaGraphInterface | undefined) | undefined;
      'predicateResolver'?: PredicateResolverFnType | undefined }
  ): QuadInterface[];
}
