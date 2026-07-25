import type { VocabProjection } from '../modules/rdf/VocabProjection.js';
import type { ShaclEmitBaseArgumentsType } from './ShaclEmitBaseArgumentsType.js';

/** Arguments for emitNodeShape. */
export type EmitNodeShapeArgumentListType = ShaclEmitBaseArgumentsType & {
  'propertyIndex': Map<string, string[]>;
  'shaclVocab': VocabProjection;
};
