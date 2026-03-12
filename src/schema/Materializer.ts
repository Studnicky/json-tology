import type { JSONSchema } from '../types/json-schema.js';
import type { InferSchema } from '../types/infer.js';
import type { SchemaRegistry } from './SchemaRegistry.js';
import {
  type GraphEngine,
  type GraphExecutionResult,
  escapeInstanceSegment,
  deterministicHash
} from './GraphEngine.js';
import type { MaterializerOptions } from '../interfaces/materializer.js';

export type { MaterializerOptions } from '../interfaces/materializer.js';
export type {
  Infer, InferSchema
} from '../types/schema.js';

export interface MaterializationResult {
  'abox': unknown[];
  'errors': string[];
  'valid': boolean;
  'value': unknown;
}

export class Materializer {
  public constructor(
    private readonly registry: SchemaRegistry,
    private readonly options: MaterializerOptions = {}
  ) {}

  public materialize<TSchema extends JSONSchema & { readonly '$id': string }>(
    schema: TSchema,
    partial?: Partial<InferSchema<TSchema>>,
  ): InferSchema<TSchema>;
  public materialize(
    schema: Record<string, unknown> & { '$id': string },
    partial?: Record<string, unknown>
  ): unknown {
    const result = this.run(schema, partial ?? {});

    if (!result.valid) {
      throw new Error(`Invalid ${schema.$id}: ${result.errors.join('; ')}`);
    }

    return result.value;
  }

  public projectAbox(
    schema: Record<string, unknown> & { '$id': string },
    data: unknown,
    baseIRI: string
  ): unknown[] {
    const result = this.run(schema, data, baseIRI);

    if (!result.valid) {
      throw new Error(`Invalid ${schema.$id}: ${result.errors.join('; ')}`);
    }

    return result.abox;
  }

  private materializeResult(engine: GraphEngine, result: GraphExecutionResult): unknown {
    const value = structuredClone(result.value);

    engine.fillImplicitProperties(result.graph, result.entryNode, value);

    return value;
  }

  private projectAboxFromExecution(engine: GraphEngine, value: unknown, baseIRI: string, pointer = ''): unknown[] {
    const execution = engine.execute(value, pointer, {
      'applyDefaults': true,
      'collectErrors': true,
      'coerce': this.registry.coerce,
      'removeAdditional': false
    });
    const materialized = this.materializeResult(engine, execution);
    const rootId = engine.rootSchemaId();

    if (rootId === undefined) {
      return [];
    }

    const instanceRoot = `${baseIRI}/instances/${escapeInstanceSegment(rootId)}-${deterministicHash(materialized)}`;
    const nodes: Array<Record<string, unknown>> = [];

    engine.projectNode(execution.graph, execution.entryNode, materialized, instanceRoot, nodes, '', engine.rootSchema);

    return nodes;
  }

  private formatErrors(result: GraphExecutionResult): string[] {
    return result.errors.map((error) => {
      return `${error.path === '' ? 'root' : error.path}: ${error.message}`;
    });
  }

  private run(
    schema: Record<string, unknown> & { '$id': string },
    data: unknown,
    baseIRI?: string
  ): MaterializationResult {
    this.registry.register(schema);

    const engine = this.registry.engine(schema);
    const execution = engine.execute(data, '', {
      'applyDefaults': true,
      'collectErrors': true,
      'coerce': this.registry.coerce,
      'ignoreAdditionalProperties': this.options.passAdditionalProperties === true,
      'removeAdditional': false
    });
    const materialized = this.materializeResult(engine, execution);

    return {
      'abox': baseIRI === undefined ? [] : this.projectAboxFromExecution(engine, materialized, baseIRI),
      'errors': this.formatErrors(execution),
      'valid': execution.valid,
      'value': materialized
    };
  }
}
