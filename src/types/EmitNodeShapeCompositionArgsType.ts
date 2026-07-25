import type { VocabProjection } from '../modules/rdf/VocabProjection.js';
import type { ShaclEmitBaseArgumentsType } from './ShaclEmitBaseArgumentsType.js';

/** Arguments for emitNodeShapeComposition. */
export type EmitNodeShapeCompositionArgumentListType = ShaclEmitBaseArgumentsType & {
  'shaclVocab': VocabProjection;
};
