import type { JsonSchemaType } from '../types/Schema.js';

/**
 * Per-schema provenance record produced by {@link JsonTology.prefetch}. Records
 * where the schema was fetched from and the wall-clock fetch time.
 */
export interface SnapshotProvenanceInterface {
  readonly 'fetchedAt': string;
  readonly 'source': string;
}

/**
 * Result of a {@link JsonTology.prefetch} call: a bundle of schemas keyed by `$id`,
 * suitable for handing to {@link JsonTology.create} via the `prefetched` option.
 *
 * `version` is a forward-compatibility discriminant for the on-disk format. The
 * current shape is 1.
 */
export interface SnapshotInterface {
  readonly 'provenance'?: Readonly<Record<string, SnapshotProvenanceInterface>>;
  readonly 'schemas': ReadonlyMap<string, JsonSchemaType>;
  readonly 'version': 1;
}
