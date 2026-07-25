import type { InferType } from './Schema.js';

/**
 * Options accepted by {@link SchemaCursorInterface.subClassOf}.
 */
export const SUB_CLASS_OF_OPTIONS_SCHEMA = {
  'properties': {
    /** When `true`, walk the full superclass chain (BFS, cycle-guarded) rather than stopping at direct parents. */
    'transitive': { 'type': 'boolean' }
  },
  'type': 'object'
} as const;

export type SubClassOfOptionsType = InferType<typeof SUB_CLASS_OF_OPTIONS_SCHEMA>;
