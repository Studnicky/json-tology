/**
 * SameAsStore — per-registry store recording `owl:sameAs` assertions
 * between individuals (ABox-level identity).
 *
 * Records pairs of instance IRIs declared as identical. Emitted at
 * `toQuads()` time as a pair of symmetric quads:
 *
 *   <A> owl:sameAs <B>
 *   <B> owl:sameAs <A>
 *
 * `owl:sameAs` is symmetric by definition, but emitting both directions
 * sidesteps reasoner divergence — every reasoner sees both edges directly
 * without relying on its own symmetry inference.
 *
 * **Blank-node trade-off:** blank-node subjects (e.g. `_:b0`) are transient
 * identifiers scoped to a single serialization call. Recording a blank-node
 * IRI here has no persistent meaning — the same blank node will get a
 * different identifier on the next `toQuads()` call. Only use `sameAs` with
 * stable named-node IRIs. Blank-node subjects silently produce quads that
 * are meaningless to any reasoner that sees them across serialization
 * boundaries.
 *
 * Distinct from `Compose.equivalent` (which is `owl:equivalentClass`,
 * a TBox/class-level construct).
 */

import type { SameAsStoreInterface } from '../../interfaces/SameAsStoreInterface.js';

export class SameAsStore implements SameAsStoreInterface {
  private readonly pairs: Array<readonly [string, string]> = [];

  /**
   * Record an `owl:sameAs` assertion between two instance IRIs.
   *
   * Idempotent: re-recording the same pair (in either direction) is a no-op.
   * Self-pairs (`a sameAs a`) are silently dropped.
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
   * Symmetric quad emission is the consumer's responsibility.
   */
  public all(): ReadonlyArray<readonly [string, string]> {
    return this.pairs;
  }

  /**
   * Clear all recorded sameAs assertions.
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
