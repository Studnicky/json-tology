/**
 * Minimal RDF/JS quad shape (compatible with `n3`, `@rdfjs/types`, etc.).
 * Used to convert external quads into the module's `QuadInterface`.
 */
export interface RdfJsQuadInterface {
  'object': {
    'datatype'?: { 'value': string };
    'language'?: string;
    'termType': string;
    'value': string;
  };
  'predicate': { 'value': string };
  'subject': { 'value': string };
}
