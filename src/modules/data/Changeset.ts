/**
 * Changeset — ordered set of diff operations
 *
 * Returned by Value.diff(). Apply with .apply().
 */

import type { ChangesetInterface } from '../../interfaces/changeset.js';
import type { DiffOpType } from '../../types/diff.js';
import {
  applyOp, clone
} from './operations.js';


/**
 * An ordered set of diff operations that transforms one value into another.
 * Returned by Value.diff(). Apply with .apply().
 *
 * @example
 * const changes = Value.diff(a, b);
 * changes.length      // number of operations
 * changes.isEmpty     // true when a and b are structurally equal
 * changes.operations  // ReadonlyArray<DiffOpType>
 * changes.apply(a)    // produce b from a without mutating a
 */
export class Changeset implements ChangesetInterface {
  public readonly operations: readonly DiffOpType[];

  public constructor(operations: readonly DiffOpType[]) {
    this.operations = operations;
  }

  /**
   * Apply this changeset to `value` and return the result.
   * The original value is never mutated.
   */
  public apply<T>(value: T): T {
    let result: unknown = clone(value);

    for (const operation of this.operations) {
      result = applyOp(result, operation);
    }

    return result as T;
  }

  /** True when there are no differences (a and b were structurally equal). */
  public get isEmpty(): boolean {
    return this.operations.length === 0;
  }

  /** Number of operations in this changeset. */
  public get length(): number {
    return this.operations.length;
  }
}
