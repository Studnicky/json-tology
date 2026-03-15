import type { DiffOpType } from '../types/diff.js';

export interface ChangesetInterface {
  apply<T>(value: T): T;
  readonly 'isEmpty': boolean;
  readonly 'length': number;
  readonly 'operations': readonly DiffOpType[];
}
