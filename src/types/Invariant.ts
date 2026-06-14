export type InvariantFnType<T = unknown> = (value: T) => null | string | undefined;

export type InvariantType<T = unknown> = {
  'fn': InvariantFnType<T>;
  'name': string;
  /** JSON Pointer for the error location. Defaults to '' (root). */
  'pointer'?: string;
};
