/**
 * Options for the fetch-based loader.
 */
export interface FetchLoaderOptionsInterface {
  /**
   * Optional base URL. When set, relative IRIs are resolved against it using
   * the URL constructor before fetching.
   */
  readonly 'base'?: string;
  /**
   * Options forwarded verbatim to `globalThis.fetch`. Useful for auth headers,
   * cache control, etc.
   */
  readonly 'init'?: RequestInit;
}
