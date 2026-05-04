import type { FormatRegistryInterface } from './FormatRegistry.js';
import type { InvariantInterface } from './Invariant.js';
import type { KeywordDefinitionInterface } from './GraphEngine.js';
import type { LoggerInterface } from './Logger.js';
import type { VocabularyPluginInterface } from './VocabularyPlugin.js';

export interface RegistryOptionsInterface {
  'castTypes'?: boolean;
  'enableDefaults'?: boolean;
  'enableDuplicateDetection'?: boolean;
  'enableInlineWarnings'?: boolean;
  'enableStrictGraph'?: boolean;
  'formatRegistry'?: FormatRegistryInterface;
  'invariants'?: Record<string, readonly InvariantInterface[]>;
  'keywords'?: KeywordDefinitionInterface[];
  'logger'?: LoggerInterface;
  'maxDepth'?: number;
  'prefixes'?: Record<string, string>;
  'strict'?: boolean;
  'vocabularies'?: readonly VocabularyPluginInterface[];
}
