/**
 * STANDARD_PREFIXES — canonical prefix-to-namespace map for well-known RDF vocabularies.
 *
 * Ported from @noocodex/rdf-iri (IRIUtils.ts). This is the single source of truth
 * for all namespace IRIs used across the project. Every IRI constant in src/constants/IRI.ts
 * is derived from this map.
 *
 * Mapping direction: prefix label → namespace IRI (ending in '#' or '/').
 * Use for compact→full expansion: STANDARD_PREFIXES[prefix] + localName.
 */
export const STANDARD_PREFIXES: Readonly<Record<string, string>> = {
  'dash': 'http://datashapes.org/dash#',
  'dc': 'http://purl.org/dc/elements/1.1/',
  'dcat': 'http://www.w3.org/ns/dcat#',
  'dct': 'http://purl.org/dc/terms/',
  'dcterms': 'http://purl.org/dc/terms/',
  'foaf': 'http://xmlns.com/foaf/0.1/',
  'geo': 'http://www.w3.org/2003/01/geo/wgs84_pos#',
  'jt': 'https://json-tology.dev/vocab#',
  'owl': 'http://www.w3.org/2002/07/owl#',
  'prov': 'http://www.w3.org/ns/prov#',
  'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  'rdfs': 'http://www.w3.org/2000/01/rdf-schema#',
  'schema': 'http://schema.org/',
  'sh': 'http://www.w3.org/ns/shacl#',
  'skos': 'http://www.w3.org/2004/02/skos/core#',
  'time': 'http://www.w3.org/2006/time#',
  'vann': 'http://purl.org/vocab/vann/',
  'xsd': 'http://www.w3.org/2001/XMLSchema#'
} as const;

/**
 * Canonical XSD namespace IRI prefix.
 *
 * Single derived constant — import this instead of re-deriving `STANDARD_PREFIXES.xsd` locally.
 */
const xsdPrefix = STANDARD_PREFIXES.xsd;

if (xsdPrefix === undefined) {
  throw new Error('STANDARD_PREFIXES.xsd is not defined');
}

export const XSD_IRI_PREFIX: string = xsdPrefix;
