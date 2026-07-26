/** A caller-supplied invariant check: returns an error message (or `null`/`undefined` when valid). */
export interface InvariantFunctionInterface<T = unknown> {
  (value: T): null | string | undefined;
}
