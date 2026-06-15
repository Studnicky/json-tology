import type { AnnotationEmitModeType } from './AnnotationEmitMode.js';
import type { SkolemizeFnType } from './Skolemize.js';

/**
 * Per-call options accepted by `toQuads`.
 *
 * `annotationEmitMode` — controls how annotation quads are emitted for
 * annotated edges. Defaults to `'star-only'` (RDF-star / triple-term quads,
 * the only form that round-trips via `fromQuads`). `'flat-only'` emits plain
 * flat triples without triple-term subjects (lossy for `fromQuads`). `'both'`
 * emits flat triples AND the RDF-star quads (lossless round-trip).
 *
 * `iriFor` — if a string IRI, overrides the root subject IRI (depth 0);
 * nested objects fall through to the default minter. If the literal
 * `'blank-node'`, every object subject is emitted as an anonymous blank
 * node `_:b<n>` (counter scoped to the projectAbox call). If a function,
 * called once per object subject with `{ path, value, depth }` and returns
 * either an IRI or `undefined` to fall through.
 *
 * `graphIRI` — when set, every emitted quad has its `graph` field stamped
 * with this IRI.
 */
export type ToQuadsOptionsType = {
  readonly 'annotationEmitMode'?: AnnotationEmitModeType | undefined;
  readonly 'graphIRI'?: string | undefined;
  readonly 'iriFor'?: SkolemizeFnType | string | undefined;
};
