import type { KeywordDefinition } from '../schema/GraphEngine.js';
import type { MaterializerOptions } from './materializer.js';
import type { RegistryLogger } from './registry.js';

export interface JsonTologyOptions<TSchemas extends readonly unknown[] = readonly unknown[]> {
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
   * Custom format validators to register in addition to (or overriding) the
   * built-in set.  Keys are format names (e.g. `"phone"`), values are
   * validator functions that return `true` when the value is valid.
   */
  'formats'?: Record<string, (value: unknown) => boolean>;

  /** Custom keyword definitions passed to the graph engine. */
  'keywords'?: KeywordDefinition[];

  /**
   * Schemas to register at construction time.
   * Use `as const` for compile-time type inference.
   */
  'schemas'?: TSchemas;
}
