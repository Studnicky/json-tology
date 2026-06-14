import type { CompiledValidatorType } from '../types/Compiler.js';
import type { GraphEngineInterface } from './GraphEngineImpl.js';
import type { SchemaGraphInterface } from './SchemaGraphImpl.js';

export interface SchemaCompilerInterface {
  compile(engine: GraphEngineInterface, graph: SchemaGraphInterface): CompiledValidatorType;
  readonly 'lookupCompiled': ((schemaId: string) => CompiledValidatorType | undefined) | undefined;
}
