/** Result of parsing a literal token from an N-Quad line. */
export interface ParsedLiteralInterface {
  readonly 'datatype': string;
  readonly 'language': string;
  readonly 'value': string;
}
