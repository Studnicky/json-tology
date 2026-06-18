import type { QuadInterface } from '../interfaces/Quad.js';
import type { LoggerInterface } from '../interfaces/Logger.js';

export type MaterializationResultType = {
  'abox': QuadInterface[];
  'errors': string[];
  'valid': boolean;
  'value': unknown;
};

export type MaterializerOptionsType = {
  /**
   * Logger for observability. Defaults to SILENT_LOGGER (no-op).
   * Receives warn on materialization failure and error on unresolvable $ref.
   */
  'logger'?: LoggerInterface;
  /**
   * When true, extra keys not declared in schema properties are allowed through
   * even if the schema has additionalProperties: false.
   * Default: false.
   */
  'passAdditionalProperties'?: boolean;
};
