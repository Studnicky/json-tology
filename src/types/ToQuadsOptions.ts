import type { SkolemizeFnType } from './Skolemize.js';

/**
 * Per-call options accepted by `toQuads`.
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
  readonly 'graphIRI'?: string | undefined;
  readonly 'iriFor'?: SkolemizeFnType | string | undefined;
};
