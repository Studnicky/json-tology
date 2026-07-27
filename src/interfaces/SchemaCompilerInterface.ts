import type { CompiledValidatorInterface } from './CompiledValidatorInterface.js';
import type { GraphEngineInterface } from './GraphEngineInterface.js';
import type { SchemaGraphInterface } from './SchemaGraphInterface.js';

export interface SchemaCompilerInterface {
  /**
   * Compile a graph into a validator.
   *
   * @throws {GraphError} code `REF_NOT_FOUND` when the schema is absent from the
   *   graph or a `$ref`/`$dynamicRef` is unresolvable at compile time — surfaced
   *   on first lazy access (validate/cast/instantiate), never as a silent
   *   accept-all validator.
   */
  compile(engine: GraphEngineInterface, graph: SchemaGraphInterface): CompiledValidatorInterface;
  readonly 'lookupCompiled': ((schemaId: string) => CompiledValidatorInterface | undefined) | undefined;
}
