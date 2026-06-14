import type { ProjectionEmitContextType } from './ProjectionEmitContext.js';
import type { RelationIndexType } from './RelationIndex.js';

/** Shared base for SHACL emit helper arg types — projection context, subject IRI, and relation index entry. */
export type ShaclEmitBaseArgsType = {
  readonly 'ctx': ProjectionEmitContextType;
  readonly 'entry': RelationIndexType;
  readonly 'subject': string;
};
