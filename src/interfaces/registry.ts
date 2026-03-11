import type { Logger } from './logger.js';

/** Logger for schema registry operations. */
export type RegistryLogger = Logger;

export interface RegistryOptions {
  /**
   * When true, the graph engine coerces primitive types during parsing and materialization
   * (e.g. 123 accepted where "123" is expected).
   */
  'coerce'?: boolean;
  'logger'?: RegistryLogger;
}
