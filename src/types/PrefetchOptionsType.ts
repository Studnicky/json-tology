import type { LoaderType } from '../types/Loader.js';

/**
 * Options for {@link JsonTology.prefetch}. Seeds the transitive `$ref` walk from
 * `rootIds` (loaded directly) and `schemas` (followed for their refs). The loader
 * is invoked for every unknown cross-schema IRI until the graph closes.
 */
export type PrefetchOptionsType = {
  readonly 'baseIRI'?: string;
  readonly 'loader': LoaderType;
  readonly 'rootIds'?: readonly string[];
  readonly 'schemas'?: ReadonlyArray<Record<string, unknown> & { readonly '$id': string }>;
};
