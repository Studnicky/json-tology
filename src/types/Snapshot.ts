import type { JsonSchemaType } from '../types/Schema.js';
import type { SchemaLoadResultType } from '../types/Loader.js';

/**
 * Per-schema provenance record produced by {@link JsonTology.prefetch}. Records
 * where the schema was fetched from and the wall-clock fetch time.
 */
export type SnapshotProvenanceType = {
  readonly 'fetchedAt': string;
  readonly 'source': string;
};

/**
 * Result of a {@link JsonTology.prefetch} call: a bundle of schemas keyed by `$id`,
 * suitable for handing to {@link JsonTology.create} via the `prefetched` option.
 *
 * `version` is a forward-compatibility discriminant for the on-disk format. The
 * current shape is 1.
 *
 * `loadResult` is an optional fail-fast load summary. A returned snapshot means all
 * loads succeeded (`failed` is always 0, `errors` is always empty). The `failed` and
 * `errors` fields are reserved for a future collect-all mode that accumulates failures
 * rather than throwing on the first one. `successful` counts schemas newly fetched via
 * the loader during this prefetch call; `skipped` counts schemas already registered
 * before the loader walk began (pre-registered via the `schemas` option or already in
 * the registry).
 */
export type SnapshotType = {
  readonly 'loadResult'?: SchemaLoadResultType;
  readonly 'provenance'?: Readonly<Record<string, SnapshotProvenanceType>>;
  readonly 'schemas': ReadonlyMap<string, JsonSchemaType>;
  readonly 'version': 1;
};
