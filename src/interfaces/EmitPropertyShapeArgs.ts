import type { ProjectionEmitContextInterface } from './ProjectionEmitContext.js';
import type { RelationIndexInterface } from './RelationIndex.js';

/** Arguments for emitPropertyShape. */
export interface EmitPropertyShapeArgsInterface {
  readonly 'bnodeId': string;
  readonly 'classId': string;
  readonly 'ctx': ProjectionEmitContextInterface;
  readonly 'entry': RelationIndexInterface;
  readonly 'overridePathClassId': string | undefined;
  readonly 'subject': string;
}
