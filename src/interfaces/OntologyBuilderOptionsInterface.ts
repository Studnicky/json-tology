import type { LoggerInterface } from './LoggerInterface.js';
import type { StringValueEntity } from '../entities/StringValueEntity.js';

/** Options accepted by the {@link OntologyBuilderInterface} constructor. */
export interface OntologyBuilderOptionsInterface {
  /**
   * Base IRI for the ontology (e.g., 'https://my-project.io')
   */
  'baseIri': StringValueEntity.Type;

  /**
   * Optional logger for ontology-build observability. Defaults to SILENT_LOGGER when omitted.
   */
  'logger'?: LoggerInterface;

  /**
   * Prefix to IRI map (e.g., { myns: 'https://my-project.io/ns#', rdf: '...' })
   */
  'prefixes': Record<string, string>;
}
