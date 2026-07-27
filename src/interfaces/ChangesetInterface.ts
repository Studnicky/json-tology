import type { DiffOpEntity } from '../entities/DiffOpEntity.js';
import type { BooleanValueEntity } from '../entities/BooleanValueEntity.js';
import type { NumberValueEntity } from '../entities/NumberValueEntity.js';

export interface ChangesetInterface {
  apply<T>(value: T): T;
  readonly 'isEmpty': BooleanValueEntity.Type;
  readonly 'length': NumberValueEntity.Type;
  readonly 'operations': readonly DiffOpEntity.Type[];
}
