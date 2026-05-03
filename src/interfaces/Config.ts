import type { InvariantInterface } from './Invariant.js';
import type { KeywordDefinitionInterface } from './GraphEngine.js';
import type { LoggerInterface } from './Logger.js';
import type { MaterializerOptionsInterface } from './Materializer.js';
import type { VocabularyPluginInterface } from './VocabularyPlugin.js';
import type { BuiltinFormatNameType } from '../types/Format.js';
import type { ComputedFnType } from '../types/Computed.js';

export interface JsonTologyOptionsInterface<TSchemas extends readonly unknown[] = readonly unknown[]> {
  /**
   * Base IRI for the ontology and schema namespace.
   * Used as the ontology document IRI and as the root for derived property IRIs.
   *
   * @example 'https://myapp.io'
   */
  'baseIRI': string;

  /**
   * When true, the graph engine casts types during validation and materialization
   * (e.g. 123 accepted where "123" is expected, and vice versa).
   */
  'castTypes'?: boolean;

  /**
   * Pre-registered compute functions, keyed by schemaId then property name.
   * Equivalent to calling addComputed() for each entry after construction.
   */
  'computeds'?: Record<string, Record<string, ComputedFnType>>;

  /**
   * Custom format validators to register in addition to (or overriding) the
   * built-in set.  Keys are format names (e.g. `"phone"`), values are
   * validator functions that return `true` when the value is valid.
   */
  'formats'?: Record<BuiltinFormatNameType | (Record<never, never> & string), (value: unknown) => boolean>;

  /**
   * Cross-field invariants to register at construction time.
   * Keyed by schema `$id`. Each invariant runs after field validation succeeds.
   */
  'invariants'?: Record<string, readonly InvariantInterface[]>;

  /** Custom keyword definitions passed to the graph engine. */
  'keywords'?: KeywordDefinitionInterface[];

  /** Logger for duplicate/conflict warnings */
  'logger'?: LoggerInterface;

  /** Materializer behaviour options */
  'materializer'?: MaterializerOptionsInterface;

  /**
   * Maximum recursion depth for schema traversal during validation.
   * Defaults to no limit (`Infinity`). Set a finite value to protect against
   * stack overflow from deeply nested or recursive schemas on deep data.
   */
  'maxDepth'?: number;

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

  /**
   * Vocabulary plugins for custom relation extraction and RDF quad projection.
   * Each plugin can extend the ontology with domain-specific predicates and constraints.
   */
  'vocabularies'?: readonly VocabularyPluginInterface[];
}
