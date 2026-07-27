import type { ShaclEmitBaseArgumentsEntity } from '../entities/ShaclEmitBaseArgumentsEntity.js';
import type { StringValueEntity } from '../entities/StringValueEntity.js';
import type { ProjectionEmitContextInterface } from './ProjectionEmitContextInterface.js';
import type { RelationIndexInterface } from './RelationIndexInterface.js';

/** Arguments for emitPropertyShape. */
export interface EmitPropertyShapeArgumentListInterface extends ShaclEmitBaseArgumentsEntity.Type {
  'bnodeId': StringValueEntity.Type;
  'classId': StringValueEntity.Type;
  'context': ProjectionEmitContextInterface;
  'entry': RelationIndexInterface;
  'overridePathClassId': string | undefined;
}
