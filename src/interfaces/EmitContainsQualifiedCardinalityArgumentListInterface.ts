import type { RelationIndexInterface } from './RelationIndexInterface.js';
import type { QuadEmitBaseInterface } from './QuadEmitBaseInterface.js';
import type { StringValueEntity } from '../entities/StringValueEntity.js';

/** Arguments for emitContainsQualifiedCardinality. */
export interface EmitContainsQualifiedCardinalityArgumentListInterface extends QuadEmitBaseInterface {
  'entry': RelationIndexInterface;
  'psBnode': StringValueEntity.Type;
}
