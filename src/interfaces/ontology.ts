export interface OntologyBuilderOptions {
  /**
   * Base IRI for the ontology (e.g., 'https://my-project.io')
   */
  baseIRI: string;

  /**
   * Prefix to IRI map (e.g., { myns: 'https://my-project.io/ns#', rdf: '...' })
   */
  prefixes: Record<string, string>;

  /**
   * Callback functions that build graph nodes.
   * Each callback receives the graph array and pushes JSON-LD-style node objects.
   */
  graphBuilders: ReadonlyArray<(graph: unknown[]) => void>;
}
