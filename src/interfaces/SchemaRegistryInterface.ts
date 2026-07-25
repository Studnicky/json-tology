import type { CompiledValidatorType } from '../types/Compiler.js';
import type { ComputedStoreInterface } from './ComputedStoreInterface.js';
import type { CurieInterface } from './CurieInterface.js';
import type { DifferentFromStoreInterface } from './DifferentFromStoreInterface.js';
import type { GraphEngineInterface } from './GraphEngineInterface.js';
import type { InvariantType } from '../types/Invariant.js';
import type { SameAsStoreInterface } from './SameAsStoreInterface.js';
import type { SchemaGraphInterface } from './SchemaGraphInterface.js';
import type { ValidationErrors } from '../errors/ValidationErrors.js';
import type { DuplicateReportEntryType } from '../types/DuplicateReportEntryType.js';
import type { SchemaWithIdType } from '../types/SchemaWithIdType.js';
import type { CloneOptionsType } from '../types/CloneOptionsType.js';
import type { InstantiateCallOptionsType } from '../types/InstantiateCallOptionsType.js';
import type { GraphEntryType } from '../types/GraphEntryType.js';

export interface SchemaRegistryInterface extends Iterable<[string, Record<string, unknown>]> {
  /**
   * Apply an OWL 2 property characteristic flag to an already-registered
   * class schema. Used by the fromTbox() registration path.
   *
   * @param propertyIri - Full property IRI (`classIri#propertyName`).
   * @param characteristic - OWL 2 name: Functional | InverseFunctional |
   *   Transitive | Symmetric | Asymmetric | Reflexive | Irreflexive.
   */
  addCharacteristic(propertyIri: string, characteristic: string): void;
  /** Add an owl:differentFrom assertion between two individual IRIs. Idempotent. */
  addDifferentFrom(iriA: string, iriB: string): void;
  addInvariant(schemaId: string, invariant: InvariantType): void;
  /**
   * Assert identity consistency: throw SchemaError(IDENTITY_CONTRADICTION) if any
   * differentFrom pair is in the same transitive sameAs component.
   */
  assertIdentityConsistency(): void;
  cast(schemaOrId: SchemaWithIdType | string, data: unknown, options?: CloneOptionsType): unknown;
  readonly 'castTypes': boolean;
  clean(schemaOrId: SchemaWithIdType | string, data: unknown): unknown;
  clear(): void;
  /**
   * Collect all non-fragment cross-schema `$ref` IRIs reachable from the given schema
   * (including its transitive dependencies already in the registry). Only returns IRIs
   * that are not already registered.
   */
  collectUnresolvedReferenceIris(schema: Record<string, unknown>): ReadonlySet<string>;
  readonly 'computedStore': ComputedStoreInterface;
  convert(schemaOrId: SchemaWithIdType | string, data: unknown, options?: CloneOptionsType): unknown;
  create(schemaId: string): unknown;
  readonly 'curie': CurieInterface | undefined;
  delete(schemaId: string): boolean;
  readonly 'differentFromStore': DifferentFromStoreInterface;
  engine(schema: Record<string, unknown>): GraphEngineInterface;
  entries(): IterableIterator<[string, Record<string, unknown>]>;
  findDuplicates(): readonly DuplicateReportEntryType[];
  forEach(
    callback: (schema: Record<string, unknown>, schemaId: string, registry: SchemaRegistryInterface) => void
  ): void;
  get(schemaId: string): Record<string, unknown> | undefined;
  graph(schemaId: string): SchemaGraphInterface | undefined;
  graphEntry(schemaId: string): GraphEntryType | undefined;
  has(schemaId: string): boolean;
  instantiate(schema: SchemaWithIdType | string, data: unknown, callOptions?: InstantiateCallOptionsType): unknown;
  is(schema: SchemaWithIdType | string, data: unknown): boolean;
  keys(): IterableIterator<string>;
  list(): ReadonlyArray<Record<string, unknown>>;
  listGraphs(): readonly SchemaGraphInterface[];
  registerAnonymous(schema: Record<string, unknown>): string;
  removeInvariant(schemaId: string, name: string): void;
  /**
   * Monotonically increasing counter incremented on every registry mutation
   * (register, set, delete, clear). Consumers cache derived views (ontology
   * builders, compiled validator graphs) by snapshotting the revision and
   * rebuilding when it advances.
   */
  readonly 'revision': number;
  readonly 'sameAsStore': SameAsStoreInterface;
  /**
   * Add or replace a schema in the registry. The schema is always the first
   * argument; the iri is derived from `schema.$id` and may be overridden by
   * passing `iri` as the second argument (rare — only when registering under
   * a non-canonical key). Bulk writes accept an array where each entry is
   * either a schema or a `[schema, iri]` tuple.
   *
   * Replaces silently on `$id` collision, per `Map.set` semantics.
   */
  set(schema: Record<string, unknown>, iri?: string): SchemaRegistryInterface;
  set(
    entries: ReadonlyArray<readonly [Record<string, unknown>, string] | Record<string, unknown>>
  ): SchemaRegistryInterface;
  readonly 'size': number;
  subschemaAt(schema: SchemaWithIdType | string, pointer: string): SchemaWithIdType;
  validate(schema: SchemaWithIdType | string, data: unknown): ValidationErrors;
  validator(schemaId: string): CompiledValidatorType;
  values(): IterableIterator<Record<string, unknown>>;
}
