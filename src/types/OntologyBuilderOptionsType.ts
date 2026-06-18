import type { LoggerInterface } from '../interfaces/LoggerInterface.js';

export type OntologyBuilderOptionsType = {
  /**
   * Base IRI for the ontology (e.g., 'https://my-project.io')
   */
  'baseIri': string;

  /**
   * Optional logger for ontology-build observability. Defaults to SILENT_LOGGER when omitted.
   */
  'logger'?: LoggerInterface;

  /**
   * Prefix to IRI map (e.g., { myns: 'https://my-project.io/ns#', rdf: '...' })
   */
  'prefixes': Record<string, string>;
};
