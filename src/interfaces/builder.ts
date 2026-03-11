export interface EntityBuilderOptions {
  /**
   * When true, extra keys not declared in schema properties are allowed through
   * even if the schema has additionalProperties: false.
   * Default: false.
   */
  passAdditionalProperties?: boolean;
}
