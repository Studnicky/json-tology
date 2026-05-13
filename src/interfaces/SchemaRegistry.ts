import type { CompiledValidatorInterface } from './Compiler.js';
import type { CurieInterface } from './Curie.js';
import type { GraphEngineInterface } from './GraphEngineImpl.js';
import type { InvariantInterface } from './Invariant.js';
import type { SchemaGraphInterface } from './SchemaGraphImpl.js';
import type { ValidationErrors } from '../errors/ValidationErrors.js';
import type { ComputedStore } from '../modules/registry/ComputedStore.js';
import type { SameAsStore } from '../modules/registry/SameAsStore.js';
import type { DuplicateReportEntryType } from '../modules/registry/SchemaRegistry.js';

export interface SchemaRegistryInterface {
  addInvariant(schemaId: string, invariant: InvariantInterface): void;
  cast(schemaOrId: (Record<string, unknown> & { '$id': string }) | string, data: unknown): unknown;
  readonly 'castTypes': boolean;
  clean(schemaOrId: (Record<string, unknown> & { '$id': string }) | string, data: unknown): unknown;
  /**
   * Collect all non-fragment cross-schema `$ref` IRIs reachable from the given schema
   * (including its transitive dependencies already in the registry). Used by the loader
   * walker in `JsonTology._resolveAllRefs` to discover which IRIs need to be fetched.
   *
   * Only returns IRIs that are NOT already registered.
   */
  collectUnresolvedRefIris(schema: Record<string, unknown>): ReadonlySet<string>;
  readonly 'computedStore': ComputedStore;
  convert(schemaOrId: (Record<string, unknown> & { '$id': string }) | string, data: unknown): unknown;
  create(schemaId: string): unknown;
  readonly 'curie': CurieInterface | undefined;
  engine(schema: Record<string, unknown>): GraphEngineInterface;
  findDuplicates(): readonly DuplicateReportEntryType[];
  get(schemaId: string): Record<string, unknown> | undefined;
  graph(schemaId: string): SchemaGraphInterface | undefined;
  instantiate(schema: (Record<string, unknown> & { '$id': string }) | string, data: unknown, callOptions?: { 'enableDefaults'?: boolean }): unknown;
  is(schema: (Record<string, unknown> & { '$id': string }) | string, data: unknown): boolean;
  list(): ReadonlyArray<Record<string, unknown>>;
  listGraphs(): readonly SchemaGraphInterface[];
  register(schemas: ReadonlyArray<Record<string, unknown>> | Record<string, unknown>): void;
  registerAnonymous(schema: Record<string, unknown>): string;
  removeInvariant(schemaId: string, name: string): void;
  readonly 'sameAsStore': SameAsStore;
  subschemaAt(schema: (Record<string, unknown> & { '$id': string }) | string, pointer: string): Record<string, unknown> & { '$id': string };
  validate(schema: (Record<string, unknown> & { '$id': string }) | string, data: unknown): ValidationErrors;
  validator(schemaId: string): CompiledValidatorInterface;
}
