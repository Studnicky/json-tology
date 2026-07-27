import type { MaterializerOptionsInterface } from './MaterializerOptionsInterface.js';
import type { SnapshotInterface } from './SnapshotInterface.js';
import type { BuiltinFormatNameEntity } from '../entities/BuiltinFormatNameEntity.js';
import type { ComputedFunctionInterface } from './ComputedFunctionInterface.js';
import type { PredicateForInterface } from './PredicateForInterface.js';
import type { SkolemizeFunctionInterface } from './SkolemizeFunctionInterface.js';
import type { BooleanValueEntity } from '../entities/BooleanValueEntity.js';
import type { NumberValueEntity } from '../entities/NumberValueEntity.js';
import type { StringValueEntity } from '../entities/StringValueEntity.js';
import type { IriForValueEntity } from '../entities/IriForValueEntity.js';
import type { SchemaRegistrySharedOptionsInterface } from './SchemaRegistrySharedOptionsInterface.js';

export interface JsonTologyOptionsInterface<TSchemas extends readonly unknown[] = readonly unknown[]>
  extends SchemaRegistrySharedOptionsInterface {
  'baseIri': StringValueEntity.Type;
  'computeds'?: Record<string, Record<string, ComputedFunctionInterface>>;
  /**
   * Default for the `deskolemize` flag on {@link fromQuads}. When true,
   * IRIs matching the well-known genid pattern are treated as blank
   * nodes during reconstruction.
   */
  'defaultDeskolemize'?: BooleanValueEntity.Type;
  /**
   * Default graph IRI applied to ABox quads when {@link toQuads} is called
   * without a per-call `graphIri`.
   */
  'defaultGraphIri'?: StringValueEntity.Type;
  /**
   * When true (the default), property predicates are derived as flat shared
   * IRIs (canonical form). Set to `false` to derive class-scoped
   * `{classId}#{propertyName}` predicates instead, where each class owns its own
   * predicate namespace. Analogous to `enableStrictGraph`: the default is the
   * most interoperable option; the class-scoped form is for DTO bundles where two
   * structurally-unrelated classes coincidentally share a property name and must
   * keep distinct predicates.
   *
   * @default true
   */
  'enableCanonicalPredicates'?: BooleanValueEntity.Type;
  'formats'?: Record<BuiltinFormatNameEntity.Type | (Record<never, never> & string), (value: unknown) => boolean>;
  /**
   * Default root-subject IRI override for {@link toQuads}, applied when a
   * call has no per-call `iriFor`/`iriForFunction`. A string is a root-only
   * IRI override (depth 0); nested objects fall through to the default hash
   * minter. The literal `'blank-node'` ({@link BLANK_NODE_IRI_FOR}) emits
   * every object subject as an anonymous blank node.
   */
  'iriFor'?: IriForValueEntity.Type;
  /**
   * Default IRI minting strategy for {@link toQuads}, applied when a call has
   * no per-call `iriFor`/`iriForFunction`. Takes precedence over `iriFor`
   * when both are set.
   */
  'iriForFunction'?: SkolemizeFunctionInterface;
  'materializer'?: MaterializerOptionsInterface;
  /**
   * Maximum schema-graph traversal depth during validation. Bounds how deeply
   * `$ref`, `allOf`, `oneOf`, and other composition keywords may recurse while
   * walking the schema graph. Throws `GraphError('RECURSION_LIMIT')` when
   * exceeded. Defaults to no limit.
   */
  'maxSchemaDepth'?: NumberValueEntity.Type;
  /**
   * Vocabulary resolver returning a predicate IRI for a property. When the
   * function returns a string, that IRI is used as the property's predicate
   * across all projection contexts (ABox, TBox, SHACL). When `undefined` is
   * returned, derivation falls through to the default logic. Analogous to the
   * subject `iriFor` option: `iriFor` customises subject IRI minting,
   * `predicateFor` customises predicate IRI derivation.
   */
  'predicateFor'?: PredicateForInterface;
  /**
   * Pre-resolved schema bundle produced by {@link JsonTology.prefetch}. Schemas
   * passed via `schemas` register first; entries from the snapshot then fill any
   * IRIs not already in the registry, so `schemas` wins on `$id` collision.
   * Schemas added via `prefetched` do not participate in the compile-time
   * `UniqueSchemaIdsType` check.
   */
  'prefetched'?: SnapshotInterface;
  'schemas'?: TSchemas;
}
