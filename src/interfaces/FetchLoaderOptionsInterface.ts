import type { StringValueEntity } from '../entities/StringValueEntity.js';

/** Options for the fetch-based loader. */
export interface FetchLoaderOptionsInterface {
  /**
   * Optional base URL. When set, relative IRIs are resolved against it using
   * the URL constructor before fetching.
   */
  'base'?: StringValueEntity.Type;
  /**
   * Options forwarded verbatim to `globalThis.fetch`. Useful for auth headers,
   * cache control, etc.
   */
  'init'?: RequestInit;
}
