/**
 * Schema loading result
 */
export interface SchemaLoadResult {
  successful: number;
  failed: number;
  skipped: number;
  errors: SchemaLoadError[];
}

/**
 * Schema load error details
 */
export interface SchemaLoadError {
  file: string;
  reason: 'not-json' | 'invalid-json' | 'no-id' | 'duplicate-id' | 'invalid-schema' | 'unknown';
  message: string;
}

import type { Logger } from './logger.js';

/** Logger for schema loading operations. */
export type SchemaLogger = Logger;
