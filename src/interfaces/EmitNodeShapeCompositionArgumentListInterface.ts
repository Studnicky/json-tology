import type { VocabProjection } from '../modules/rdf/VocabProjection.js';
import type { ShaclEmitBaseArgumentsEntity } from '../entities/ShaclEmitBaseArgumentsEntity.js';
import type { ProjectionEmitContextInterface } from './ProjectionEmitContextInterface.js';
import type { RelationIndexInterface } from './RelationIndexInterface.js';

/** Arguments for emitNodeShapeComposition. */
export interface EmitNodeShapeCompositionArgumentListInterface extends ShaclEmitBaseArgumentsEntity.Type {
  'context': ProjectionEmitContextInterface;
  'entry': RelationIndexInterface;
  'shaclVocab': VocabProjection;
}
