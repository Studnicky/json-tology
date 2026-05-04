import type { CompiledValidatorInterface } from './Compiler.js';
import type { CurieInterface } from './Curie.js';
import type { GraphEngineInterface } from './GraphEngineImpl.js';
import type { InvariantInterface } from './Invariant.js';
import type { SchemaGraphInterface } from './SchemaGraphImpl.js';
import type { ValidationErrors } from '../errors/ValidationErrors.js';
import type { ComputedStore } from '../modules/registry/ComputedStore.js';
import type { DuplicateReportEntryType } from '../modules/registry/SchemaRegistry.js';

export interface SchemaRegistryInterface {
  addInvariant(schemaId: string, invariant: InvariantInterface): void;
  cast(schemaOrId: (Record<string, unknown> & { '$id': string }) | string, data: unknown): unknown;
  readonly 'castTypes': boolean;
  clean(schemaOrId: (Record<string, unknown> & { '$id': string }) | string, data: unknown): unknown;
  coerce(schema: (Record<string, unknown> & { '$id': string }) | string, data: unknown, callOptions?: { 'enableDefaults'?: boolean }): unknown;
  readonly 'computedStore': ComputedStore;
  convert(schemaOrId: (Record<string, unknown> & { '$id': string }) | string, data: unknown): unknown;
  create(schemaId: string): unknown;
  readonly 'curie': CurieInterface | undefined;
  engine(schema: Record<string, unknown>): GraphEngineInterface;
  findDuplicates(): readonly DuplicateReportEntryType[];
  get(schemaId: string): Record<string, unknown> | undefined;
  graph(schemaId: string): SchemaGraphInterface | undefined;
  is(schema: (Record<string, unknown> & { '$id': string }) | string, data: unknown): boolean;
  list(): ReadonlyArray<Record<string, unknown>>;
  listGraphs(): readonly SchemaGraphInterface[];
  register(schemas: ReadonlyArray<Record<string, unknown>> | Record<string, unknown>): void;
  registerAnonymous(schema: Record<string, unknown>): string;
  removeInvariant(schemaId: string, name: string): void;
  validate(schema: (Record<string, unknown> & { '$id': string }) | string, data: unknown): ValidationErrors;
  validateAt(schema: (Record<string, unknown> & { '$id': string }) | string, pointer: string, data: unknown): string[];
  validator(schemaId: string): CompiledValidatorInterface;
}
