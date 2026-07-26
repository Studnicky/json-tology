import type { AnnotationEmitModeEntity } from '../entities/AnnotationEmitModeEntity.js';
import type { SkolemizeFunctionInterface } from './SkolemizeFunctionInterface.js';
import type { GraphIriValueEntity } from '../entities/GraphIriValueEntity.js';
import type { IriForValueEntity } from '../entities/IriForValueEntity.js';

/**
 * Per-call options accepted by `toQuads`.
 *
 * `annotationEmitMode` — controls how annotation quads are emitted for
 * annotated edges. Defaults to `'star-only'` (RDF-star / triple-term quads,
 * the only form that round-trips via `fromQuads`). `'flat-only'` emits plain
 * flat triples without triple-term subjects (lossy for `fromQuads`). `'both'`
 * emits flat triples AND the RDF-star quads (lossless round-trip).
 *
 * `iriFor` — a string IRI overriding the root subject IRI (depth 0); nested
 * objects fall through to the default minter. The literal `'blank-node'`
 * emits every object subject as an anonymous blank node `_:b<n>` (counter
 * scoped to the projectAbox call).
 *
 * `iriForFunction` — a function `(ctx) => string | undefined` called once per
 * object subject with `{ path, value, depth }`, returning either an IRI or
 * `undefined` to fall through. Takes precedence over `iriFor` when both are set.
 *
 * `graphIri` — when set, every emitted quad has its `graph` field stamped
 * with this IRI.
 */
export interface ToQuadsOptionsInterface {
  'annotationEmitMode'?: AnnotationEmitModeEntity.Type | undefined;
  'graphIri'?: GraphIriValueEntity.Type | undefined;
  'iriFor'?: IriForValueEntity.Type | undefined;
  'iriForFunction'?: SkolemizeFunctionInterface | undefined;
}
