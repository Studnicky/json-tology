/**
 * Options bag shapes for `QuadFactory` helpers.
 *
 * Required arguments stay positional. Optional / configuration values
 * collapse into a single trailing options object, aligned with the
 * project-wide DX convention.
 */

import type { CurieInterface } from '../interfaces/CurieInterface.js';
import type { IdentityType } from './IdentityType.js';
import type { QuadOptionsType } from './QuadOptionsType.js';

/**
 * Options for `QuadFactory.iri(value, options?)`.
 *
 * Provide `curie` to expand compact IRIs (`prefix:local`) against a
 * shared `CurieInterface` instance.
 */
export type QuadFactoryIriOptionsType = IdentityType<{
  'curie'?: CurieInterface | undefined;
}>;

/**
 * Options for `QuadFactory.literal(value, datatype, options?)`.
 *
 * Provide `curie` to expand compact CURIE datatypes against a shared
 * `CurieInterface` instance.
 */
export type QuadFactoryLiteralOptionsType = IdentityType<{
  'curie'?: CurieInterface | undefined;
  /**
   * BCP47 language tag. When a non-empty string is supplied the literal is
   * emitted as a language-tagged literal (`rdf:langString`) and the positional
   * `datatype` argument is ignored.
   */
  'language'?: string | undefined;
}>;

/**
 * Options for `QuadFactory.quad(subject, predicate, object, options?)`.
 *
 * - `curie` expands compact subject/predicate IRIs.
 * - `graph` sets the rdf/js graph term on the produced quad
 *   (defaults to the default-graph singleton).
 */
export type QuadFactoryQuadOptionsType = IdentityType<QuadOptionsType>;

/**
 * Options for `QuadFactory.emitLiterals` /
 * `QuadFactory.emitConstraintLiteral` — shared shape across the
 * literal-emission helpers.
 */
export type QuadFactoryEmitOptionsType = IdentityType<{
  'curie'?: CurieInterface | undefined;
}>;
