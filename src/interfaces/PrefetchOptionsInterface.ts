import type { LoaderInterface } from './LoaderInterface.js';
import type { StringValueEntity } from '../entities/StringValueEntity.js';
import type { StringArrayEntity } from '../entities/StringArrayEntity.js';
import type { SchemaWithIdEntity } from '../entities/SchemaWithIdEntity.js';

/**
 * Options for {@link JsonTology.prefetch}. Seeds the transitive `$ref` walk from
 * `rootIds` (loaded directly) and `schemas` (followed for their refs). The loader
 * is invoked for every unknown cross-schema IRI until the graph closes.
 */
export interface PrefetchOptionsInterface {
  'baseIri'?: StringValueEntity.Type;
  'loader': LoaderInterface;
  'rootIds'?: StringArrayEntity.Type;
  'schemas'?: readonly SchemaWithIdEntity.Type[];
}
