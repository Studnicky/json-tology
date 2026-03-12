import type { GraphExecutionResultInterface } from '../../interfaces/graph-engine.js';
import type { MaterializationResultInterface, MaterializerOptionsInterface } from '../../interfaces/materializer.js';
import type { InferSchemaType } from '../../types/infer.js';
import type { JSONSchema7Definition as JSONSchemaType } from 'json-schema';
import { BaseError } from '../errors/BaseError.js';
import { GraphEngine } from '../graph/GraphEngine.js';
import type { SchemaRegistry } from '../registry/SchemaRegistry.js';


export class Materializer {
  public constructor(
    private readonly registry: SchemaRegistry,
    private readonly options: MaterializerOptionsInterface = {}
  ) { }

  public materialize<TSchema extends JSONSchemaType & { readonly '$id': string; }>(
    schema: TSchema,
    partial?: Partial<InferSchemaType<TSchema>>,
  ): InferSchemaType<TSchema>;
  public materialize(
    schema: Record<string, unknown> & { '$id': string; },
    partial?: Record<string, unknown>
  ): unknown {
    const result = this.run(schema, partial ?? {});

    if (!result.valid) {
      throw new Error(`Invalid ${schema.$id}: ${result.errors.join('; ')}`);
    }

    return result.value;
  }

  public projectAbox(
    schema: Record<string, unknown> & { '$id': string; },
    data: unknown,
    baseIRI: string
  ): unknown[] {
    const result = this.run(schema, data, baseIRI);

    if (!result.valid) {
      throw new Error(`Invalid ${schema.$id}: ${result.errors.join('; ')}`);
    }

    return result.abox;
  }

  private materializeResult(engine: GraphEngine, result: GraphExecutionResultInterface): unknown {
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

    const instanceRoot = `${baseIRI}/instances/${GraphEngine.escapeSegment(rootId)}-${GraphEngine.hash(materialized)}`;
    const nodes: Array<Record<string, unknown>> = [];

    engine.projectNode(execution.graph, execution.entryNode, materialized, instanceRoot, nodes, '', engine.rootSchema);

    return nodes;
  }

  private formatErrors(result: GraphExecutionResultInterface): string[] {
    return BaseError.formatErrors(result.errors);
  }

  private run(
    schema: Record<string, unknown> & { '$id': string; },
    data: unknown,
    baseIRI?: string
  ): MaterializationResultInterface {
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
