import type { InferType } from './Schema.js';

/**
 * Options accepted by {@link MaterializerInterface.execute}.
 */
export const MATERIALIZER_EXECUTE_OPTIONS_SCHEMA = {
  'properties': {
    'baseIri': { 'type': 'string' },
    'data': {},
    'synthesizeDefaults': { 'type': 'boolean' }
  },
  'type': 'object'
} as const;

export type MaterializerExecuteOptionsType = InferType<typeof MATERIALIZER_EXECUTE_OPTIONS_SCHEMA>;
