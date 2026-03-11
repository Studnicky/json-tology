import type { Options as AjvOptions } from 'ajv';
import type { Logger } from './logger.js';

/** Logger for schema registry operations. */
export type RegistryLogger = Logger;

export interface RegistryOptions {
  ajv?: AjvOptions;
  logger?: RegistryLogger;
  /**
   * When true, AJV coerces types during validation and entity building
   * (e.g. 123 accepted where "123" is expected).
   */
  coerce?: boolean;
}
