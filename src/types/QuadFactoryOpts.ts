/**
 * Options bag shapes for `QuadFactory` helpers.
 *
 * Required arguments stay positional. Optional / configuration values
 * collapse into a single trailing options object, aligned with the
 * project-wide DX convention.
 */

import type { CurieInterface } from '../interfaces/CurieInterface.js';
import type {
  DefaultGraphTermType, IriTermType
} from '../types/Quad.js';

/**
 * Options for `QuadFactory.iri(value, options?)`.
 *
 * Provide `curie` to expand compact IRIs (`prefix:local`) against a
 * shared `CurieInterface` instance.
 */
export type QuadFactoryIriOptsType = {
  'curie'?: CurieInterface | undefined;
};

/**
 * Options for `QuadFactory.literal(value, datatype, options?)`.
 *
 * Provide `curie` to expand compact CURIE datatypes against a shared
 * `CurieInterface` instance.
 */
export type QuadFactoryLiteralOptsType = {
  'curie'?: CurieInterface | undefined;
  /**
   * BCP47 language tag. When a non-empty string is supplied the literal is
   * emitted as a language-tagged literal (`rdf:langString`) and the positional
   * `datatype` argument is ignored.
   */
  'language'?: string | undefined;
};

/**
 * Options for `QuadFactory.quad(subject, predicate, object, options?)`.
 *
 * - `curie` expands compact subject/predicate IRIs.
 * - `graph` sets the rdf/js graph term on the produced quad
 *   (defaults to the default-graph singleton).
 */
export type QuadFactoryQuadOptsType = {
  'curie'?: CurieInterface | undefined;
  'graph'?: DefaultGraphTermType | IriTermType | undefined;
};

/**
 * Options for `QuadFactory.emitLiterals` /
 * `QuadFactory.emitConstraintLiteral` — shared shape across the
 * literal-emission helpers.
 */
export type QuadFactoryEmitOptsType = {
  'curie'?: CurieInterface | undefined;
};
