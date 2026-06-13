import type { ProjectionEmitContextInterface } from './ProjectionEmitContext.js';
import type { RelationIndexInterface } from './RelationIndex.js';
import type { VocabProjection } from '../modules/rdf/VocabProjection.js';

/** Arguments for emitNodeShape. */
export interface EmitNodeShapeArgsInterface {
  readonly 'ctx': ProjectionEmitContextInterface;
  readonly 'entry': RelationIndexInterface;
  readonly 'propertyIndex': Map<string, string[]>;
  readonly 'shaclVocab': VocabProjection;
  readonly 'subject': string;
}
