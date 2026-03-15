import type { DiffOpType } from '../types/diff.js';

export interface ChangesetInterface {
  readonly operations: readonly DiffOpType[];
  readonly isEmpty: boolean;
  readonly length: number;
  apply<T>(value: T): T;
}
