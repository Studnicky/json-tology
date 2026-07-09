/** Result of parsing a literal token from an N-Quad line. */
export type ParsedLiteralType = {
  'datatype': string;
  'language': string;
  'value': string;
};
