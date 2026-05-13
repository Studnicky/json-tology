import type { InvariantInterface } from './Invariant.js';
import type { KeywordDefinitionInterface } from './GraphEngine.js';
import type { LoggerInterface } from './Logger.js';
import type { MaterializerOptionsInterface } from './Materializer.js';
import type { VocabularyPluginInterface } from './VocabularyPlugin.js';
import type { BuiltinFormatNameType } from '../types/Format.js';
import type { ComputedFnType } from '../types/Computed.js';
import type { LoaderType } from '../types/Loader.js';
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
  /**
   * Pluggable async schema-fetch hook for transitive `$ref` resolution.
   *
   * When provided, `JsonTology.create()` returns a `Promise<JsonTology>` and
   * eagerly walks all transitive `$ref` IRIs, calling this loader for any IRI
   * not already in the registry. After the promise resolves the instance is
   * fully warmed — all hot-path methods (`validate`, `instantiate`, `is`, etc.)
   * remain synchronous.
   *
   * Returning `null` for a required IRI throws `GraphError('REF_UNRESOLVED')`.
   * Network errors should propagate so callers see real connectivity failures.
   *
   * Without a loader, the sync API is unchanged.
   *
   * @see {@link Loaders} for pre-built helpers (fetch, memory, cached, compose).
   */
  'loader'?: LoaderType;
  'logger'?: LoggerInterface;
  'materializer'?: MaterializerOptionsInterface;
  /**
   * Maximum schema-graph traversal depth during validation. Bounds how deeply
   * `$ref`, `allOf`, `oneOf`, and other composition keywords may recurse while
   * walking the schema graph. Throws `GraphError('RECURSION_LIMIT')` when
   * exceeded. Defaults to no limit.
   */
  'maxSchemaDepth'?: number;
  'prefixes'?: Record<string, string>;
  'schemas'?: TSchemas;
  'vocabularies'?: readonly VocabularyPluginInterface[];
}
