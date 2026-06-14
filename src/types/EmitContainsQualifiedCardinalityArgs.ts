import type { RelationIndexType } from './RelationIndex.js';
import type { QuadEmitBaseType } from './QuadEmitBase.js';

/** Arguments for emitContainsQualifiedCardinality. */
export type EmitContainsQualifiedCardinalityArgsType = QuadEmitBaseType & {
  readonly 'entry': RelationIndexType;
  readonly 'psBnode': string;
};
