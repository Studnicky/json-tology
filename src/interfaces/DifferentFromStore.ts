/**
 * Interface contract for the owl:differentFrom assertion store.
 *
 * Records pairs of individual IRIs declared as distinct via `owl:differentFrom`.
 */
export interface DifferentFromStoreInterface {
  add(iriA: string, iriB: string): void;
  all(): ReadonlyArray<readonly [string, string]>;
  clear(): void;
  has(iriA: string, iriB: string): boolean;
}
