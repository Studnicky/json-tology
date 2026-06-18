import type { ProjectionEmitContextType } from './ProjectionEmitContextType.js';
import type { RelationIndexType } from './RelationIndexType.js';

/** Arguments for emitPatternPropertyEntry. */
export type EmitPatternPropertyEntryArgsType = {
  readonly 'ctx': ProjectionEmitContextType;
  readonly 'pattern': string;
  readonly 'patternEntry': RelationIndexType | undefined;
  readonly 'subject': string;
};
