import type { FormatRegistryInterface } from './format-registry.js';
import type { KeywordDefinitionInterface } from './graph-engine.js';
import type { LoggerInterface } from './logger.js';

export interface RegistryOptionsInterface {
  /**
   * When true, the graph engine coerces primitive types during parsing and materialization
   * (e.g. 123 accepted where "123" is expected).
   */
  'coerce'?: boolean;
  /** Optional format registry to pass to the graph engine. */
  'formatRegistry'?: FormatRegistryInterface;
  /** Custom keyword definitions passed to the graph engine. */
  'keywords'?: KeywordDefinitionInterface[];
  'logger'?: LoggerInterface;
  /** When true, validate that $schema references draft 2020-12. */
  'strict'?: boolean;
}
