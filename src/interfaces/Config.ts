import type { InvariantInterface } from './Invariant.js';
import type { KeywordDefinitionInterface } from './GraphEngine.js';
import type { LoggerInterface } from './Logger.js';
import type { MaterializerOptionsInterface } from './Materializer.js';
import type { VocabularyPluginInterface } from './VocabularyPlugin.js';
import type { BuiltinFormatNameType } from '../types/Format.js';
import type { ComputedFnType } from '../types/Computed.js';
import type { SkolemizeFnType } from '../types/Skolemize.js';

export interface JsonTologyOptionsInterface<TSchemas extends readonly unknown[] = readonly unknown[]> {
  'baseIRI': string;
  'computeds'?: Record<string, Record<string, ComputedFnType>>;
  /**
   * Default for the `deskolemize` flag on {@link fromQuads}. When true,
   * IRIs matching the well-known genid pattern are treated as blank
   * nodes during reconstruction.
   */
  readonly 'defaultDeskolemize'?: boolean;
  /**
   * Default graph IRI applied to ABox quads when {@link toQuads} is called
   * without a per-call `graphIRI`.
   */
  readonly 'defaultGraphIRI'?: string;
  'enableDebug'?: boolean;
  'enableDefaults'?: boolean;
  'enableDuplicateDetection'?: boolean;
  'enableInlineWarnings'?: boolean;
  'enableStrictGraph'?: boolean;
  'enableStrictTypes'?: boolean;
  'enableTypeCast'?: boolean;
  'formats'?: Record<BuiltinFormatNameType | (Record<never, never> & string), (value: unknown) => boolean>;
  'invariants'?: Record<string, readonly InvariantInterface[]>;
  /**
   * Default IRI minting strategy for {@link toQuads}. A string is treated
   * as a root-only IRI override (depth 0); nested objects fall through to
   * the default hash minter. A function is the full {@link SkolemizeFnType}
   * shape. Per-call options on `toQuads` override this default.
   */
  readonly 'iriFor'?: SkolemizeFnType | string;
  'keywords'?: KeywordDefinitionInterface[];
  'logger'?: LoggerInterface;
  'materializer'?: MaterializerOptionsInterface;
  'maxDepth'?: number;
  'prefixes'?: Record<string, string>;
  'schemas'?: TSchemas;
  'vocabularies'?: readonly VocabularyPluginInterface[];
}
