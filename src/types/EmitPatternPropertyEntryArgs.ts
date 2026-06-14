import type { ProjectionEmitContextType } from './ProjectionEmitContext.js';
import type { RelationIndexType } from './RelationIndex.js';

/** Arguments for emitPatternPropertyEntry. */
export type EmitPatternPropertyEntryArgsType = {
  readonly 'ctx': ProjectionEmitContextType;
  readonly 'pattern': string;
  readonly 'patternEntry': RelationIndexType | undefined;
  readonly 'subject': string;
};
