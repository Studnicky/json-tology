import type { CompiledValidatorInterface } from './compiler.js';
import type { GraphEngine } from '../modules/graph/GraphEngine.js';

export interface SchemaCompilerInterface {
  readonly lookupCompiled: ((schemaId: string) => CompiledValidatorInterface | undefined) | undefined;
  compile(engine: GraphEngine): CompiledValidatorInterface;
}
