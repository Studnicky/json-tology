/**
 * Accepted JSON-LD document shapes for `addFromJsonLd` / `addShaclFromJsonLd`.
 */
export type JsonLdDocInput = ReadonlyArray<Record<string, unknown>> | Record<string, unknown>;

export interface OntologyBuilderOptionsInterface {
  /**
   * Base IRI for the ontology (e.g., 'https://my-project.io')
   */
  'baseIRI': string;

  /**
   * Prefix to IRI map (e.g., { myns: 'https://my-project.io/ns#', rdf: '...' })
   */
  'prefixes': Record<string, string>;
}
