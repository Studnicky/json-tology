import type { VocabProjection } from '../modules/rdf/VocabProjection.js';
import type { ShaclEmitBaseArgsType } from './ShaclEmitBaseArgsType.js';

/** Arguments for emitNodeShape. */
export type EmitNodeShapeArgsType = ShaclEmitBaseArgsType & {
  'propertyIndex': Map<string, string[]>;
  'shaclVocab': VocabProjection;
};
