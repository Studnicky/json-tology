import type { InvariantInterface } from './Invariant.js';
import type { KeywordDefinitionInterface } from './GraphEngine.js';
import type { LoggerInterface } from './Logger.js';
import type { MaterializerOptionsInterface } from './Materializer.js';
import type { SnapshotInterface } from './Snapshot.js';
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
  /**
   * When true, the registry scans all registered schemas after each
   * `register()` call and raises an error or warning when two distinct
   * schema pointers produce structurally equivalent shapes. When
   * `enableStrictGraph` is also true (the default), duplicate shapes cause
   * `SchemaError('SCHEMA_DUPLICATE_SHAPE')` at registration time; otherwise
   * a `logger.warn` is emitted. Setting `enableStrictGraph` to `true`
   * forces this flag on regardless of the value passed here.
   *
   * @default true
   */
  'enableDuplicateDetection'?: boolean;
  /**
   * When true, registering a schema with inline primitive constraints
   * (e.g. `{ type: 'number', minimum: 0 }` embedded in a property instead
   * of a `$ref` to a named primitive) emits a `logger.warn`. When combined
   * with `enableStrictGraph` (the default), the same condition throws
   * `SchemaError('SCHEMA_STRUCTURE_INVALID')` at registration time.
   * Setting `enableStrictGraph` to `true` forces this flag on regardless
   * of the value passed here.
   *
   * @default true
   */
  'enableInlineWarnings'?: boolean;
  /**
   * Master graph-integrity gate. When true (the default), both
   * `enableInlineWarnings` and `enableDuplicateDetection` are forced on,
   * and any violation they detect is thrown as a `SchemaError` rather than
   * logged as a warning. Set to `false` to downgrade all graph-integrity
   * violations to `logger.warn` — the individual flags then control which
   * checks run at all. Consumers that need the historical permissive
   * behaviour should pass `enableStrictGraph: false` explicitly.
   *
   * @default true
   */
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
  /**
   * Maximum schema-graph traversal depth during validation. Bounds how deeply
   * `$ref`, `allOf`, `oneOf`, and other composition keywords may recurse while
   * walking the schema graph. Throws `GraphError('RECURSION_LIMIT')` when
   * exceeded. Defaults to no limit.
   */
  'maxSchemaDepth'?: number;
  /**
   * Pre-resolved schema bundle produced by {@link JsonTology.prefetch}. Schemas
   * passed via `schemas` register first; entries from the snapshot then fill any
   * IRIs not already in the registry, so `schemas` wins on `$id` collision.
   * Schemas added via `prefetched` do not participate in the compile-time
   * `UniqueSchemaIdsType` check.
   */
  'prefetched'?: SnapshotInterface;
  'prefixes'?: Record<string, string>;
  'schemas'?: TSchemas;
  'vocabularies'?: readonly VocabularyPluginInterface[];
}
