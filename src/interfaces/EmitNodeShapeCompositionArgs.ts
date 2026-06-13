import type { ProjectionEmitContextInterface } from './ProjectionEmitContext.js';
import type { RelationIndexInterface } from './RelationIndex.js';
import type { VocabProjection } from '../modules/rdf/VocabProjection.js';

/** Arguments for emitNodeShapeComposition. */
export interface EmitNodeShapeCompositionArgsInterface {
  readonly 'ctx': ProjectionEmitContextInterface;
  readonly 'entry': RelationIndexInterface;
  readonly 'shaclVocab': VocabProjection;
  readonly 'subject': string;
}
