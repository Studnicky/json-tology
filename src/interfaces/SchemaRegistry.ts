import type { CompiledValidatorInterface } from './Compiler.js';
import type { CurieInterface } from './Curie.js';
import type { GraphEngineInterface } from './GraphEngineImpl.js';
import type { SchemaGraphInterface } from './SchemaGraphImpl.js';
import type { ValidationErrors } from '../errors/ValidationErrors.js';

export interface SchemaRegistryInterface {
  cast(schemaOrId: (Record<string, unknown> & { '$id': string }) | string, data: unknown): unknown;
  readonly 'castTypes': boolean;
  clean(schemaOrId: (Record<string, unknown> & { '$id': string }) | string, data: unknown): unknown;
  coerce(schema: (Record<string, unknown> & { '$id': string }) | string, data: unknown): unknown;
  convert(schemaOrId: (Record<string, unknown> & { '$id': string }) | string, data: unknown): unknown;
  create(schemaId: string): unknown;
  readonly 'curie': CurieInterface | undefined;
  engine(schema: Record<string, unknown>): GraphEngineInterface;
  errors(schema: (Record<string, unknown> & { '$id': string }) | string, data: unknown): ValidationErrors;
  get(schemaId: string): Record<string, unknown> | undefined;
  graph(schemaId: string): SchemaGraphInterface | undefined;
  is(schema: (Record<string, unknown> & { '$id': string }) | string, data: unknown): boolean;
  list(): ReadonlyArray<Record<string, unknown>>;
  listGraphs(): readonly SchemaGraphInterface[];
  register(schemas: ReadonlyArray<Record<string, unknown>> | Record<string, unknown>): void;
  registerAnonymous(schema: Record<string, unknown>): string;
  validate(schema: (Record<string, unknown> & { '$id': string }) | string, data: unknown): string[];
  validateAt(schema: (Record<string, unknown> & { '$id': string }) | string, pointer: string, data: unknown): string[];
  validator(schemaId: string): CompiledValidatorInterface;
}
