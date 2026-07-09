import type { VocabProjection } from '../modules/rdf/VocabProjection.js';
import type { ShaclEmitBaseArgsType } from './ShaclEmitBaseArgsType.js';

/** Arguments for emitNodeShapeComposition. */
export type EmitNodeShapeCompositionArgsType = ShaclEmitBaseArgsType & {
  'shaclVocab': VocabProjection;
};
