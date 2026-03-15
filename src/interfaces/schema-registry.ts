import type { CompiledValidatorInterface } from './compiler.js';
import type { GraphEngineInterface } from './graph-engine-impl.js';
import type { SchemaGraphInterface } from './schema-graph-impl.js';
import type { ValidationErrors } from '../errors/ValidationErrors.js';

export interface SchemaRegistryInterface {
  readonly coerce: boolean;
  cast(schemaOrId: (Record<string, unknown> & { '$id': string }) | string, data: unknown): unknown;
  clean(schemaOrId: (Record<string, unknown> & { '$id': string }) | string, data: unknown): unknown;
  convert(schemaOrId: (Record<string, unknown> & { '$id': string }) | string, data: unknown): unknown;
  create(schemaId: string): unknown;
  engine(schema: Record<string, unknown>): GraphEngineInterface;
  errors(schema: (Record<string, unknown> & { '$id': string }) | string, data: unknown): ValidationErrors;
  get(schemaId: string): Record<string, unknown> | undefined;
  graph(schemaId: string): SchemaGraphInterface | undefined;
  is(schema: (Record<string, unknown> & { '$id': string }) | string, data: unknown): boolean;
  list(): ReadonlyArray<Record<string, unknown>>;
  listGraphs(): readonly SchemaGraphInterface[];
  parse(schema: (Record<string, unknown> & { '$id': string }) | string, data: unknown): unknown;
  register(schemas: ReadonlyArray<Record<string, unknown>> | Record<string, unknown>): void;
  registerAnonymous(schema: Record<string, unknown>): string;
  validate(schema: (Record<string, unknown> & { '$id': string }) | string, data: unknown): string[];
  validateAt(schema: (Record<string, unknown> & { '$id': string }) | string, pointer: string, data: unknown): string[];
  validator(schemaId: string): CompiledValidatorInterface;
}
