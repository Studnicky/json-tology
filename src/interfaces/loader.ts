/**
 * Schema loading result
 */
export interface SchemaLoadResult {
  'errors': SchemaLoadError[];
  'failed': number;
  'skipped': number;
  'successful': number;
}

/**
 * Schema load error details
 */
export interface SchemaLoadError {
  'file': string;
  'message': string;
  'reason': 'duplicate-id' | 'invalid-json' | 'invalid-schema' | 'no-id' | 'not-json' | 'unknown';
}

import type { Logger } from './logger.js';

/** Logger for schema loading operations. */
export type SchemaLogger = Logger;
