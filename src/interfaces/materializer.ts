import type { QuadInterface } from './quad.js';

export interface MaterializationResultInterface {
  'abox': QuadInterface[];
  'errors': string[];
  'valid': boolean;
  'value': unknown;
}

export interface MaterializerOptionsInterface {
  /**
   * When true, extra keys not declared in schema properties are allowed through
   * even if the schema has additionalProperties: false.
   * Default: false.
   */
  'passAdditionalProperties'?: boolean;
}
