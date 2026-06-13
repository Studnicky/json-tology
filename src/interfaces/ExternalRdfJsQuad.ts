/**
 * ExternalRdfJsQuad — minimal RDF/JS quad shape as returned by jsonld.js v8
 * in object-graph output mode (`{ '@default': [...] }`).
 *
 * Only the fields required by OwlImporter's fromJsonLdRdfOutput conversion
 * helper are declared here.
 */

export interface ExternalRdfJsQuad {
  'object': {
    'datatype'?: { 'value': string };
    'language'?: string;
    'termType': string;
    'value': string
  };
  'predicate': { 'value': string };
  'subject': { 'value': string }
}
