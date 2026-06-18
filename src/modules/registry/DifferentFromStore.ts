/**
 * DifferentFromStore — per-registry store recording `owl:differentFrom` assertions
 * between individuals (ABox-level distinctness).
 *
 * Records pairs of instance IRIs declared as distinct. Used by
 * `SchemaRegistry.assertIdentityConsistency()` to detect contradictions
 * with transitive owl:sameAs closures.
 *
 * `add(a, b)` is idempotent (canonical-order dedup) and self-drops self-pairs.
 */

import type { DifferentFromStoreInterface } from '../../interfaces/DifferentFromStore.js';

export class DifferentFromStore implements DifferentFromStoreInterface {
  private readonly pairs: Array<readonly [string, string]> = [];

  /**
   * Record an `owl:differentFrom` assertion between two instance IRIs.
   *
   * Idempotent: re-recording the same pair (in either direction) is a no-op.
   * Self-pairs (`a differentFrom a`) are silently dropped.
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
   * Returns the recorded pairs (one entry per declared assertion).
   */
  public all(): ReadonlyArray<readonly [string, string]> {
    return this.pairs;
  }

  /**
   * Clear all recorded differentFrom assertions.
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
