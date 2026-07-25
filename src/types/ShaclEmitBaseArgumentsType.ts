import type { ProjectionEmitContextType } from './ProjectionEmitContextType.js';
import type { RelationIndexType } from './RelationIndexType.js';
import type { InferType } from './Schema.js';

export const SHACL_EMIT_BASE_ARGUMENTS_DATA_SCHEMA = {
  'properties': { 'subject': { 'type': 'string' } },
  'required': ['subject'],
  'type': 'object'
} as const;

/** Shared base for SHACL emit helper arg types — projection context, subject IRI, and relation index entry. */
export type ShaclEmitBaseArgumentsType = InferType<typeof SHACL_EMIT_BASE_ARGUMENTS_DATA_SCHEMA> & {
  'context': ProjectionEmitContextType;
  'entry': RelationIndexType;
};
