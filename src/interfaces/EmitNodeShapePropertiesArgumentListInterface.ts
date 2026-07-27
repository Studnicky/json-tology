import type { ShaclEmitBaseArgumentsEntity } from '../entities/ShaclEmitBaseArgumentsEntity.js';
import type { ProjectionEmitContextInterface } from './ProjectionEmitContextInterface.js';
import type { RelationIndexInterface } from './RelationIndexInterface.js';

/** Arguments for emitNodeShapeProperties. */
export interface EmitNodeShapePropertiesArgumentListInterface extends ShaclEmitBaseArgumentsEntity.Type {
  'context': ProjectionEmitContextInterface;
  'entry': RelationIndexInterface;
  'propertyIndex': Record<string, string[]>;
}
