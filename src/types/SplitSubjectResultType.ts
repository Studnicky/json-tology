import type { InferType } from './Schema.js';

/**
 * Result of {@link SchemaIriInterface.splitSubject} — a subject IRI split
 * into base and fragment parts at the `#` boundary.
 */
export const SPLIT_SUBJECT_RESULT_SCHEMA = {
  'properties': {
    'base': { 'type': 'string' },
    'fragment': {
      'type': [
        'string',
        'null'
      ]
    }
  },
  'required': [
    'base',
    'fragment'
  ],
  'type': 'object'
} as const;

export type SplitSubjectResultType = InferType<typeof SPLIT_SUBJECT_RESULT_SCHEMA>;
