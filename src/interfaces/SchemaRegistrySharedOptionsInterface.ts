import type { InvariantType } from '../types/Invariant.js';
import type { KeywordDefinitionInterface } from './KeywordDefinitionInterface.js';
import type { LoggerInterface } from './LoggerInterface.js';
import type { VocabularyPluginInterface } from './VocabularyPluginInterface.js';
import type { BooleanValueEntity } from '../entities/BooleanValueEntity.js';

/**
 * Graph-integrity flags and registry plumbing shared by
 * {@link JsonTologyOptionsInterface} (the public facade) and
 * {@link RegistryOptionsInterface} (the lower `SchemaRegistry` layer it
 * constructs from).
 */
export interface SchemaRegistrySharedOptionsInterface {
  'enableDebug'?: BooleanValueEntity.Type;
  'enableDefaults'?: BooleanValueEntity.Type;
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
  'enableDuplicateDetection'?: BooleanValueEntity.Type;
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
  'enableInlineWarnings'?: BooleanValueEntity.Type;
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
  'enableStrictGraph'?: BooleanValueEntity.Type;
  'enableStrictTypes'?: BooleanValueEntity.Type;
  'enableTypeCast'?: BooleanValueEntity.Type;
  'invariants'?: Record<string, InvariantType[]>;
  'keywords'?: KeywordDefinitionInterface[];
  'logger'?: LoggerInterface;
  'prefixes'?: Record<string, string>;
  'vocabularies'?: VocabularyPluginInterface[];
}
