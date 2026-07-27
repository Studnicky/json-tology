import type { CurieInterface } from './CurieInterface.js';

/**
 * Options for `QuadFactory.literal(value, datatype, options?)`.
 *
 * Provide `curie` to expand compact CURIE datatypes against a shared
 * `CurieInterface` instance.
 */
export interface QuadFactoryLiteralOptionsInterface {
  'curie'?: CurieInterface | undefined;
  /**
   * BCP47 language tag. When a non-empty string is supplied the literal is
   * emitted as a language-tagged literal (`rdf:langString`) and the positional
   * `datatype` argument is ignored.
   */
  'language'?: string | undefined;
}
