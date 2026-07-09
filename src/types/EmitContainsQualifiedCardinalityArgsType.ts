import type { RelationIndexType } from './RelationIndexType.js';
import type { QuadEmitBaseType } from './QuadEmitBaseType.js';

/** Arguments for emitContainsQualifiedCardinality. */
export type EmitContainsQualifiedCardinalityArgsType = QuadEmitBaseType & {
  'entry': RelationIndexType;
  'psBnode': string;
};
