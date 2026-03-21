import type { CompiledValidatorInterface } from './compiler.js';
import type { GraphEngineInterface } from './graph-engine-impl.js';

export interface SchemaCompilerInterface {
  compile(engine: GraphEngineInterface): CompiledValidatorInterface;
  readonly 'lookupCompiled': ((schemaId: string) => CompiledValidatorInterface | undefined) | undefined;
}
