import type { ProjectionEmitContextInterface } from './ProjectionEmitContext.js';
import type { RelationIndexInterface } from './RelationIndex.js';

/** Arguments for emitPatternPropertyEntry. */
export interface EmitPatternPropertyEntryArgsInterface {
  readonly 'ctx': ProjectionEmitContextInterface;
  readonly 'pattern': string;
  readonly 'patternEntry': RelationIndexInterface | undefined;
  readonly 'subject': string;
}
