import type { RegistryLogger } from './registry.js';
import type { MaterializerOptions } from './materializer.js';

export interface JsonTologyOptions {
  /**
   * Base IRI for the ontology and schema namespace.
   * Used as the ontology document IRI and as the root for derived property IRIs.
   *
   * @example 'https://myapp.io'
   */
  'baseIRI': string;

  /** Materializer behaviour options */
  'materializer'?: MaterializerOptions;

  /**
   * When true, the graph engine coerces types during parsing and materialization
   * (e.g. 123 accepted where "123" is expected, and vice versa).
   */
  'coerce'?: boolean;

  /** Logger for duplicate/conflict warnings */
  'logger'?: RegistryLogger;

  /**
   * Additional prefix declarations for ontology output.
   * owl, rdf, rdfs, and xsd are always included.
   */
  'prefixes'?: Record<string, string>;

  /**
   * Schemas to register at construction time.
   * Additional schemas can be registered later via .register().
   */
  'schemas'?: ReadonlyArray<Record<string, unknown>>;
}
