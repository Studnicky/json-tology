import type { FormatRegistryInterface } from './format-registry.js';
import type { KeywordDefinitionInterface } from './graph-engine.js';
import type { LoggerInterface } from './logger.js';
import type { VocabularyPluginInterface } from './vocabulary-plugin.js';

export interface RegistryOptionsInterface {
  /**
   * When true, the graph engine casts primitive types during validation and materialization
   * (e.g. 123 accepted where "123" is expected).
   */
  'castTypes'?: boolean;
  /** Optional format registry to pass to the graph engine. */
  'formatRegistry'?: FormatRegistryInterface;
  /** Custom keyword definitions passed to the graph engine. */
  'keywords'?: KeywordDefinitionInterface[];
  'logger'?: LoggerInterface;
  /** Prefix-to-namespace map for CURIE expansion/compaction (e.g. `{ acl: 'https://acl.io/' }`). */
  'prefixes'?: Record<string, string>;
  /** When true, validate that $schema references draft 2020-12. */
  'strict'?: boolean;
  /** Vocabulary plugins for custom RDF vocabularies and semantic extensions. */
  'vocabularies'?: readonly VocabularyPluginInterface[];
}
