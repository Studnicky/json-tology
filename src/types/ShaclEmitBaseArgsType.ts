import type { ProjectionEmitContextType } from './ProjectionEmitContextType.js';
import type { RelationIndexType } from './RelationIndexType.js';

/** Shared base for SHACL emit helper arg types — projection context, subject IRI, and relation index entry. */
export type ShaclEmitBaseArgsType = {
  'ctx': ProjectionEmitContextType;
  'entry': RelationIndexType;
  'subject': string;
};
