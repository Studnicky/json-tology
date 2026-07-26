import type { VocabProjection } from '../modules/rdf/VocabProjection.js';
import type { ShaclEmitBaseArgumentsEntity } from '../entities/ShaclEmitBaseArgumentsEntity.js';
import type { ProjectionEmitContextInterface } from './ProjectionEmitContextInterface.js';
import type { RelationIndexInterface } from './RelationIndexInterface.js';

/** Arguments for emitNodeShape. */
export interface EmitNodeShapeArgumentListInterface extends ShaclEmitBaseArgumentsEntity.Type {
  'context': ProjectionEmitContextInterface;
  'entry': RelationIndexInterface;
  'propertyIndex': Record<string, string[]>;
  'shaclVocab': VocabProjection;
}
