import type { VocabProjection } from '../modules/rdf/VocabProjection.js';
import type { ShaclEmitBaseArgsType } from './ShaclEmitBaseArgs.js';

/** Arguments for emitNodeShape. */
export type EmitNodeShapeArgsType = ShaclEmitBaseArgsType & {
  readonly 'propertyIndex': Map<string, string[]>;
  readonly 'shaclVocab': VocabProjection;
};
