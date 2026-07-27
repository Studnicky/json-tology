import type { CurieInterface } from './CurieInterface.js';

/**
 * Options for `QuadFactory.iri(value, options?)`.
 *
 * Provide `curie` to expand compact IRIs (`prefix:local`) against a
 * shared `CurieInterface` instance.
 */
export interface QuadFactoryIriOptionsInterface {
  'curie'?: CurieInterface | undefined;
}
