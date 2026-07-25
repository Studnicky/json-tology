import type { ProjectionEmitContextType } from './ProjectionEmitContextType.js';
import type { RelationIndexType } from './RelationIndexType.js';

/** Arguments for emitPatternPropertyEntry. */
export type EmitPatternPropertyEntryArgumentListType = {
  'context': ProjectionEmitContextType;
  'patternEntry': RelationIndexType | undefined;
} & {
  'pattern': string;
  'subject': string;
};
