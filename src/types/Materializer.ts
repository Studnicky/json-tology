import type { QuadInterface } from '../interfaces/Quad.js';

export type MaterializationResultType = {
  'abox': QuadInterface[];
  'errors': string[];
  'valid': boolean;
  'value': unknown;
};

export type MaterializerOptionsType = {
  /**
   * When true, extra keys not declared in schema properties are allowed through
   * even if the schema has additionalProperties: false.
   * Default: false.
   */
  'passAdditionalProperties'?: boolean;
};
