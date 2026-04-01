import type { CompiledValidatorInterface } from './Compiler.js';
import type { GraphEngineInterface } from './GraphEngineImpl.js';
import type { SchemaGraphInterface } from './SchemaGraphImpl.js';

export interface SchemaRegistryEntryInterface {
  'compiled'?: CompiledValidatorInterface;
  'engine'?: GraphEngineInterface;
  'graph'?: SchemaGraphInterface;
  'hash': string;
  'schema': Record<string, unknown>;
}
