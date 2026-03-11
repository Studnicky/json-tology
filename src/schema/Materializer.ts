import type {
  FromSchema, JSONSchema
} from 'json-schema-to-ts';
import type { SchemaRegistry } from './SchemaRegistry.js';
import {
  GraphEngine, type GraphExecutionResult
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
    partial?: Partial<FromSchema<TSchema>>,
  ): FromSchema<TSchema>;
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

    const engineSchema = this.options.passAdditionalProperties === true
      ? this.relaxAdditionalProperties(schema)
      : schema;
    const engine = new GraphEngine(engineSchema, {
      'lookupSchema': (lookupSchemaId) => {
        return this.registry.get(lookupSchemaId);
      }
    });
    const execution = engine.execute(data, '', {
      'applyDefaults': true,
      'collectErrors': true,
      'coerce': this.registry.coerce,
      'removeAdditional': false
    });
    const materialized = engine.materializeResult(execution);

    return {
      'abox': baseIRI === undefined ? [] : engine.projectAbox(materialized, baseIRI),
      'errors': this.formatErrors(execution),
      'valid': execution.valid,
      'value': materialized
    };
  }

  private relaxAdditionalProperties(schema: Record<string, unknown>): Record<string, unknown> {
    const relaxed = structuredClone(schema);

    delete relaxed.additionalProperties;

    return relaxed;
  }
}
