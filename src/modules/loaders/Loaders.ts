/**
 * Loaders — universal, pluggable schema-fetch helpers.
 *
 * Every helper returns a {@link LoaderType} function that can be composed and
 * passed to {@link JsonTology.prefetch}. No Node-only built-ins are used; all
 * helpers work in Node ≥ 18, Bun, Deno, and browsers.
 */

import type { JsonSchemaType } from '../../types/Schema.js';
import type { LoaderType } from '../../types/Loader.js';
import type { FetchLoaderOptionsType } from '../../types/FetchLoaderOptionsType.js';
import { SchemaLoadError } from '../../errors/SchemaLoadError.js';
import { SCHEMA_LOAD_ERROR_CODE } from '../../constants/ERROR_CODES.js';

/** Lowest HTTP status treated as a transient (retryable) server-side failure. */
const HTTP_SERVER_ERROR_MIN = 500;

/**
 * Namespace of universal schema-loading helpers.
 *
 * @example
 * ```ts
 * const snapshot = await JsonTology.prefetch({
 *   loader: Loaders.cached(
 *     Loaders.fetch({ base: 'https://schemas.example/v1' })
 *   ),
 *   schemas: [LocalSchema],
 * });
 *
 * const jt = JsonTology.create({
 *   baseIri: 'https://example.com',
 *   prefetched: snapshot,
 *   schemas: [LocalSchema] as const,
 * });
 * ```
 */
export const Loaders = {
  /**
   * Wraps a loader with an LRU cache keyed by IRI.
   *
   * Both resolved schemas and `null` (unknown IRI) results are cached so
   * repeated requests for the same IRI never hit the underlying loader twice.
   *
   * @param loader - The loader to wrap.
   * @param options.maxSize - Maximum number of entries to keep (default: 1024).
   */
  cached(loader: LoaderType, options?: { 'maxSize'?: number }): LoaderType {
    const maxSize = options?.maxSize ?? 1024;
    // Simple LRU via insertion-order Map: delete + re-insert on hit.
    const cache = new Map<string, JsonSchemaType | null>();

    return async (iri: string): Promise<JsonSchemaType | null> => {
      if (cache.has(iri)) {
        // LRU: move to end by delete + re-insert
        const cached = cache.get(iri) as JsonSchemaType | null;

        cache.delete(iri);
        cache.set(iri, cached);

        return cached;
      }

      const result = await loader(iri);

      if (cache.size >= maxSize) {
        // Evict oldest (first) entry
        const oldest = cache.keys().next().value;

        if (oldest !== undefined) {
          cache.delete(oldest);
        }
      }
      cache.set(iri, result);

      return result;
    };
  },

  /**
   * Chains multiple loaders in order. Returns the first non-null result.
   * If all loaders return `null`, returns `null`.
   *
   * @param loaders - One or more loaders to try in order.
   */
  compose(...loaders: LoaderType[]): LoaderType {
    return async (iri: string): Promise<JsonSchemaType | null> => {
      for (const loader of loaders) {
        const result = await loader(iri);

        if (result !== null) {
          return result;
        }
      }

      return null;
    };
  },

  /**
   * Fetches schemas from a remote origin using `globalThis.fetch`.
   *
   * Works in Node ≥ 18, Bun, Deno, and browsers — no Node-specific built-ins.
   * 4xx / 5xx responses produce `null` (unknown IRI). Network errors throw so
   * callers see real connectivity failures.
   *
   * @param options - Optional base URL and RequestInit overrides.
   */
  fetch(options?: FetchLoaderOptionsType): LoaderType {
    const base = options?.base;
    const init = options?.init;

    return async (iri: string): Promise<JsonSchemaType | null> => {
      const url = base === undefined ? iri : new URL(iri, base).toString();
      const response = await globalThis.fetch(url, init);

      if (response.ok) {
        return response.json() as Promise<JsonSchemaType>;
      }

      // 5xx responses indicate a transient server-side failure — throw a
      // SchemaLoadError so callers can distinguish infrastructure failures
      // (retryable) from unknown-IRI signals (not retryable).
      // 4xx responses collapse to null per the LoaderType contract: null signals
      // "IRI unknown to this loader" so the next layer (GraphError REF_UNRESOLVED)
      // carries the full IRI with no status noise.
      if (response.status >= HTTP_SERVER_ERROR_MIN) {
        throw new SchemaLoadError(`HTTP ${response.status} loading ${url}`, {
          'code': SCHEMA_LOAD_ERROR_CODE.LOAD_FAILED,
          'file': url,
          'reason': 'fetch-failed',
          'retryable': true,
          'status': response.status
        });
      }

      return null;
    };
  },

  /**
   * Returns a loader backed by an in-memory map of IRI → schema.
   *
   * Useful for testing or for pre-bundling schemas at build time.
   *
   * @param map - A `Map` or plain object keyed by IRI.
   */
  memory(map: Map<string, JsonSchemaType> | Record<string, JsonSchemaType>): LoaderType {
    const lookup: ReadonlyMap<string, JsonSchemaType> = map instanceof Map
      ? map
      : new Map(Object.entries(map));

    return (iri: string): Promise<JsonSchemaType | null> => {
      const result = Promise.resolve(lookup.get(iri) ?? null);

      return result;
    };
  }
} as const;
