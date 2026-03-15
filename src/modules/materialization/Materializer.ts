import type { GraphExecutionResultInterface } from '../../interfaces/graph-engine.js';
import type {
  MaterializationResultInterface, MaterializerOptionsInterface
} from '../../interfaces/materializer.js';
import type { MaterializerInterface } from '../../interfaces/materializer-impl.js';
import type { SchemaGraphNodeInterface } from '../../interfaces/schema-graph.js';
import type { QuadInterface } from '../../interfaces/quad.js';
import type { SchemaGraphInterface } from '../../interfaces/schema-graph-impl.js';
import type { SchemaRegistryInterface } from '../../interfaces/schema-registry.js';
import type { InferSchemaType } from '../../types/infer.js';
import type { JSONSchema7Definition as JSONSchemaType } from 'json-schema';
import { BaseError } from '../../errors/BaseError.js';
import { MaterializationError } from '../../errors/MaterializationError.js';
import { GraphError } from '../../errors/GraphError.js';
import { isRecord } from '../data/DataTypes.js';
import { SchemaGraph } from '../graph/SchemaGraph.js';
import { projectAbox as projectAboxQuads } from '../rdf/Projection.js';

const isObject = isRecord;


/**
 * Materializer — runtime projection over validation execution results.
 *
 * The runtime contract has three disciplined stages:
 *
 * 1. **Validation execution** (`GraphEngine.execute()`) — validates data against
 *    the canonical graph and applies defaults/coercion during traversal.
 *
 * 2. **Materialization** (`materialize()`) — projects validation execution output
 *    into a fully-populated JS value with implicit properties filled.
 *
 * 3. **ABox projection** (`projectAbox()`) — projects materialized state into
 *    RDF quads that can be serialized with the same ontology tooling as TBox output.
 *
 * `createDefault()` uses the same execution engine with `synthesizeDefaults: true`,
 * which generates zero values for required properties without explicit defaults
 * instead of reporting validation errors. This is `materialize(schema)` with no args.
 */
export class Materializer implements MaterializerInterface {
  private readonly graphCache = new WeakMap<object, SchemaGraph>();

  public constructor(
    private readonly registry: SchemaRegistryInterface,
    private readonly options: MaterializerOptionsInterface = {}
  ) {}

  public createDefault(schema: Record<string, unknown> & { '$id': string }): unknown {
    const result = this.run(schema, undefined, undefined, true);

    return result.value;
  }

  /**
   * Execute materialization and return the full result without throwing.
   * The caller decides what to use from the output.
   */
  public execute(
    schema: Record<string, unknown> & { '$id': string },
    data?: unknown,
    options?: { 'baseIRI'?: string;
      'synthesizeDefaults'?: boolean }
  ): MaterializationResultInterface {
    const baseIRI = options?.baseIRI;
    const synthesize = options?.synthesizeDefaults === true;
    const runResult = this.run(schema, data, baseIRI, synthesize);

    return runResult;
  }
  private fillImplicitProperties(
    graph: SchemaGraphInterface,
    node: SchemaGraphNodeInterface,
    value: unknown
  ): void {
    const targetNode = this.resolveGraphTargetNode(graph, node);

    if (!isRecord(value)) {
      return;
    }

    for (const [
      propertyName,
      propertyNode
    ] of graph.semantics(targetNode).properties) {
      if (!(propertyName in value)) {
        value[propertyName] = undefined;
        continue;
      }

      const propertyValue = value[propertyName];
      const propertyTargetNode = this.resolveGraphTargetNode(graph, propertyNode);

      if (Array.isArray(propertyValue)) {
        const itemsNode = graph.semantics(propertyTargetNode).itemsNode;

        if (itemsNode === undefined) {
          continue;
        }

        for (const item of propertyValue) {
          this.fillImplicitProperties(graph, itemsNode, item);
        }

        continue;
      }

      this.fillImplicitProperties(graph, propertyTargetNode, propertyValue);
    }
  }

  private formatErrors(result: GraphExecutionResultInterface): string[] {
    return BaseError.formatErrors(result.errors);
  }

  private graphFor(rootSchema: JSONSchemaType): SchemaGraph {
    if (!isObject(rootSchema)) {
      return new SchemaGraph(rootSchema as boolean);
    }

    const cached = this.graphCache.get(rootSchema);

    if (cached !== undefined) {
      return cached;
    }

    const graph = new SchemaGraph(rootSchema);

    this.graphCache.set(rootSchema, graph);

    return graph;
  }

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
      throw new MaterializationError(schema.$id, result.errors);
    }

    return result.value;
  }

  private materializeResult(result: GraphExecutionResultInterface): unknown {
    const value = structuredClone(result.value);

    this.fillImplicitProperties(result.graph, result.entryNode, value);

    return value;
  }

  public projectAbox(
    schema: Record<string, unknown> & { '$id': string; },
    data: unknown,
    baseIRI: string
  ): QuadInterface[] {
    const result = this.run(schema, data, baseIRI);

    if (!result.valid) {
      throw new MaterializationError(schema.$id, result.errors);
    }

    return result.abox;
  }

  private projectAboxFromExecution(
    execution: GraphExecutionResultInterface,
    materialized: unknown,
    baseIRI: string
  ): QuadInterface[] {
    const quads = projectAboxQuads(execution.graph, materialized, baseIRI, execution.entryNode);

    return quads;
  }

  private resolveGraphTargetNode(
    graph: SchemaGraphInterface,
    schemaNode: SchemaGraphNodeInterface
  ): SchemaGraphNodeInterface {
    const semantics = graph.semantics(schemaNode);

    if (semantics.ref === undefined) {
      return schemaNode;
    }

    const ref = semantics.ref;

    if (ref.startsWith('#')) {
      const fragment = ref.slice(1);

      return graph.resolveFragment(fragment);
    }

    const hashIndex = ref.indexOf('#');
    const schemaId = hashIndex === -1 ? ref : ref.slice(0, hashIndex);
    const fragment = hashIndex === -1 ? '' : ref.slice(hashIndex + 1);

    const lookedUp = this.registry.get(schemaId) as JSONSchemaType | undefined;

    if (lookedUp === undefined) {
      throw new GraphError('REF_UNRESOLVED', `Unresolved schema reference: ${ref}`, ref);
    }

    if (!isObject(lookedUp)) {
      return schemaNode;
    }

    const targetGraph = this.graphFor(lookedUp);

    return targetGraph.resolveFragment(fragment);
  }

  private run(
    schema: Record<string, unknown> & { '$id': string; },
    data: unknown,
    baseIRI?: string,
    synthesizeDefaults = false
  ): MaterializationResultInterface {
    this.registry.register(schema);

    const engine = this.registry.engine(schema);
    const execution = engine.execute(data, '', {
      'applyDefaults': true,
      'coerce': this.registry.coerce,
      'collectErrors': true,
      'ignoreAdditionalProperties': this.options.passAdditionalProperties === true,
      'removeAdditional': false,
      'synthesizeDefaults': synthesizeDefaults
    });
    const materialized = synthesizeDefaults
      ? structuredClone(execution.value)
      : this.materializeResult(execution);

    const abox = baseIRI === undefined
      ? []
      : this.projectAboxFromExecution(execution, materialized, baseIRI);

    return {
      abox,
      'errors': this.formatErrors(execution),
      'valid': execution.valid,
      'value': materialized
    };
  }
}
