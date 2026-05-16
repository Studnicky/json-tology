import type { CompiledValidatorInterface } from './Compiler.js';
import type { GraphEngineInterface } from './GraphEngineImpl.js';
import type { SchemaGraphInterface } from './SchemaGraphImpl.js';

export interface SchemaRegistryEntryInterface {
  'compiled'?: CompiledValidatorInterface;
  'engine'?: GraphEngineInterface;
  'graph'?: SchemaGraphInterface;
  'hasComputedFields': boolean;
  'hasEmbeddedIds': boolean;
  'hash': string;
  'refsChecked'?: boolean;
  'schema': Record<string, unknown>;
}
