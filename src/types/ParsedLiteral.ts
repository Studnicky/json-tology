/** Result of parsing a literal token from an N-Quad line. */
export type ParsedLiteralType = {
  readonly 'datatype': string;
  readonly 'language': string;
  readonly 'value': string;
};
