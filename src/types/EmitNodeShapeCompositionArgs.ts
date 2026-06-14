import type { VocabProjection } from '../modules/rdf/VocabProjection.js';
import type { ShaclEmitBaseArgsType } from './ShaclEmitBaseArgs.js';

/** Arguments for emitNodeShapeComposition. */
export type EmitNodeShapeCompositionArgsType = ShaclEmitBaseArgsType & {
  readonly 'shaclVocab': VocabProjection;
};
