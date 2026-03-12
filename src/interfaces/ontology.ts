export interface OntologyBuilderOptionsInterface {
  /**
   * Base IRI for the ontology (e.g., 'https://my-project.io')
   */
  'baseIRI': string;

  /**
   * Static graph node collections or producer functions.
   * Each producer returns JSON-LD-style node objects directly.
   */
  'graphSources': ReadonlyArray<ReadonlyArray<unknown> | (() => ReadonlyArray<unknown>)>;

  /**
   * Prefix to IRI map (e.g., { myns: 'https://my-project.io/ns#', rdf: '...' })
   */
  'prefixes': Record<string, string>;
}
