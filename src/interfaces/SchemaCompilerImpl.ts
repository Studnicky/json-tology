import type { CompiledValidatorInterface } from './Compiler.js';
import type { GraphEngineInterface } from './GraphEngineImpl.js';

export interface SchemaCompilerInterface {
  compile(engine: GraphEngineInterface): CompiledValidatorInterface;
  readonly 'lookupCompiled': ((schemaId: string) => CompiledValidatorInterface | undefined) | undefined;
}
