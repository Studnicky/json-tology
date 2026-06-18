import type { DiffOpType } from '../types/Diff.js';

export interface ChangesetInterface {
  apply<T>(value: T): T;
  readonly 'isEmpty': boolean;
  readonly 'length': number;
  readonly 'operations': readonly DiffOpType[];
}
