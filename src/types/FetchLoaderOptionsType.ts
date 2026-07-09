/**
 * Options for the fetch-based loader.
 */
export type FetchLoaderOptionsType = {
  /**
   * Optional base URL. When set, relative IRIs are resolved against it using
   * the URL constructor before fetching.
   */
  'base'?: string;
  /**
   * Options forwarded verbatim to `globalThis.fetch`. Useful for auth headers,
   * cache control, etc.
   */
  'init'?: RequestInit;
};
