/**
 * SymmetricPairStore — order-independent store of IRI pairs.
 *
 * Shared by `DifferentFromStore` and `SameAsStore`: both record symmetric
 * ABox-level assertions (`owl:differentFrom`, `owl:sameAs`) between instance
 * IRIs and only differ in which OWL predicate the caller associates with
 * the recorded pairs.
 *
 * `add(a, b)` is idempotent (canonical-order dedup) and self-drops self-pairs.
 */
export class SymmetricPairStore {
  private readonly pairs: Array<readonly [string, string]> = [];

  /**
   * Record a pair of instance IRIs.
   *
   * Idempotent: re-recording the same pair (in either direction) is a no-op.
   * Self-pairs (`a`, `a`) are silently dropped.
   */
  public add(iriA: string, iriB: string): void {
    if (iriA === iriB) {
      return;
    }
    if (this.has(iriA, iriB)) {
      return;
    }
    this.pairs.push([
      iriA,
      iriB
    ] as const);
  }

  /**
   * Returns the recorded pairs (one entry per recorded assertion).
   */
  public all(): ReadonlyArray<readonly [string, string]> {
    return this.pairs;
  }

  /**
   * Clear all recorded pairs.
   */
  public clear(): void {
    this.pairs.length = 0;
  }

  public has(iriA: string, iriB: string): boolean {
    for (const [
      a,
      b
    ] of this.pairs) {
      if ((a === iriA && b === iriB) || (a === iriB && b === iriA)) {
        return true;
      }
    }

    return false;
  }
}
