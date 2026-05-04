import type { InvariantInterface } from './Invariant.js';
import type { KeywordDefinitionInterface } from './GraphEngine.js';
import type { LoggerInterface } from './Logger.js';
import type { MaterializerOptionsInterface } from './Materializer.js';
import type { VocabularyPluginInterface } from './VocabularyPlugin.js';
import type { BuiltinFormatNameType } from '../types/Format.js';
import type { ComputedFnType } from '../types/Computed.js';

export interface JsonTologyOptionsInterface<TSchemas extends readonly unknown[] = readonly unknown[]> {
  'baseIRI': string;
  'castTypes'?: boolean;
  'computeds'?: Record<string, Record<string, ComputedFnType>>;
  'enableDefaults'?: boolean;
  'enableDuplicateDetection'?: boolean;
  'enableInlineWarnings'?: boolean;
  'enableStrictGraph'?: boolean;
  'formats'?: Record<BuiltinFormatNameType | (Record<never, never> & string), (value: unknown) => boolean>;
  'invariants'?: Record<string, readonly InvariantInterface[]>;
  'keywords'?: KeywordDefinitionInterface[];
  'logger'?: LoggerInterface;
  'materializer'?: MaterializerOptionsInterface;
  'maxDepth'?: number;
  'prefixes'?: Record<string, string>;
  'schemas'?: TSchemas;
  'strict'?: boolean;
  'vocabularies'?: readonly VocabularyPluginInterface[];
}
