/**
 * Interface contract for the owl:sameAs assertion store.
 *
 * Records pairs of individual IRIs declared as identical via `owl:sameAs`.
 * Emitted symmetrically at `toQuads()` time.
 */
export interface SameAsStoreInterface {
  add(iriA: string, iriB: string): void;
  all(): ReadonlyArray<readonly [string, string]>;
  clear(): void;
  has(iriA: string, iriB: string): boolean;
}
