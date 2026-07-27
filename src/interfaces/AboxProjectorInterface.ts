import type { QuadInterface } from './QuadInterface.js';
import type { SchemaGraphInterface } from './SchemaGraphInterface.js';
import type { AboxProjectionOptionsInterface } from './AboxProjectionOptionsInterface.js';

/**
 * Behavioral contract for ABox projection — projecting validated instance data
 * into RDF quads against a canonical {@link SchemaGraphInterface}.
 *
 * @remarks
 * This contract exists to invert the materialization → rdf layering. The
 * `materialization` layer must not import `rdf/` directly; instead the facade
 * ({@link JsonTology}) injects the concrete `Projection` (which satisfies this
 * contract) into the {@link Materializer} via `MaterializerOptionsInterface`. The
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
    options?: AboxProjectionOptionsInterface
  ): QuadInterface[];
}
