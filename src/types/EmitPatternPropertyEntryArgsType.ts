import type { ProjectionEmitContextType } from './ProjectionEmitContextType.js';
import type { RelationIndexType } from './RelationIndexType.js';

/** Arguments for emitPatternPropertyEntry. */
export type EmitPatternPropertyEntryArgsType = {
  'ctx': ProjectionEmitContextType;
  'pattern': string;
  'patternEntry': RelationIndexType | undefined;
  'subject': string;
};
