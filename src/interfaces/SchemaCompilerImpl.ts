import type { CompiledValidatorInterface } from './Compiler.js';
import type { GraphEngineInterface } from './GraphEngineImpl.js';
import type { SchemaGraphInterface } from './SchemaGraphImpl.js';

export interface SchemaCompilerInterface {
  compile(engine: GraphEngineInterface, graph?: SchemaGraphInterface): CompiledValidatorInterface;
  readonly 'lookupCompiled': ((schemaId: string) => CompiledValidatorInterface | undefined) | undefined;
}
