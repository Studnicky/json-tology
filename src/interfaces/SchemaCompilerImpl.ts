import type { CompiledValidatorType } from '../types/Compiler.js';
import type { GraphEngineInterface } from './GraphEngineImpl.js';
import type { SchemaGraphInterface } from './SchemaGraphImpl.js';

export interface SchemaCompilerInterface {
  /**
   * Compile a graph into a validator.
   *
   * @throws {GraphError} code `REF_NOT_FOUND` when the schema is absent from the
   *   graph or a `$ref`/`$dynamicRef` is unresolvable at compile time — surfaced
   *   on first lazy access (validate/cast/instantiate), never as a silent
   *   accept-all validator.
   */
  compile(engine: GraphEngineInterface, graph: SchemaGraphInterface): CompiledValidatorType;
  readonly 'lookupCompiled': ((schemaId: string) => CompiledValidatorType | undefined) | undefined;
}
