import type { CompiledValidatorInterface } from './compiler.js';
import type { GraphEngine } from '../modules/graph/GraphEngine.js';

export interface SchemaCompilerInterface {
  compile(engine: GraphEngine): CompiledValidatorInterface;
  readonly 'lookupCompiled': ((schemaId: string) => CompiledValidatorInterface | undefined) | undefined;
}
