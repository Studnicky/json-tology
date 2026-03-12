export interface MaterializationResultInterface {
  'abox': unknown[];
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
