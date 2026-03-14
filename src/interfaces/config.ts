import type { KeywordDefinitionInterface } from './graph-engine.js';
import type { LoggerInterface } from './logger.js';
import type { MaterializerOptionsInterface } from './materializer.js';

export interface JsonTologyOptionsInterface<TSchemas extends readonly unknown[] = readonly unknown[]> {
  /**
   * Base IRI for the ontology and schema namespace.
   * Used as the ontology document IRI and as the root for derived property IRIs.
   *
   * @example 'https://myapp.io'
   */
  'baseIRI': string;

  /**
   * When true, the graph engine coerces types during parsing and materialization
   * (e.g. 123 accepted where "123" is expected, and vice versa).
   */
  'coerce'?: boolean;

  /**
   * Custom format validators to register in addition to (or overriding) the
   * built-in set.  Keys are format names (e.g. `"phone"`), values are
   * validator functions that return `true` when the value is valid.
   */
  'formats'?: Record<string, (value: unknown) => boolean>;

  /** Custom keyword definitions passed to the graph engine. */
  'keywords'?: KeywordDefinitionInterface[];

  /** Logger for duplicate/conflict warnings */
  'logger'?: LoggerInterface;

  /** Materializer behaviour options */
  'materializer'?: MaterializerOptionsInterface;

  /**
   * Additional prefix declarations for ontology output.
   * owl, rdf, rdfs, and xsd are always included.
   */
  'prefixes'?: Record<string, string>;

  /**
   * Schemas to register at construction time.
   * Use `as const` for compile-time type inference.
   */
  'schemas'?: TSchemas;

  /**
   * When true, enforces draft 2020-12 dialect declarations and rejects unknown dialects at registration time.
   */
  'strict'?: boolean;
}
