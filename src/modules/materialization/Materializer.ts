import type { GraphExecutionResultInterface } from '../../interfaces/GraphEngine.js';
import type {
  MaterializationResultInterface, MaterializerOptionsInterface
} from '../../interfaces/Materializer.js';
import type { MaterializerInterface } from '../../interfaces/MaterializerImpl.js';
import type { SchemaGraphNodeInterface } from '../../interfaces/SchemaGraph.js';
import type { QuadInterface } from '../../interfaces/Quad.js';
import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphImpl.js';
import type { SchemaRegistryInterface } from '../../interfaces/SchemaRegistry.js';
import type { InferSchemaType } from '../../types/Infer.js';
import type { JSONSchema7Definition } from 'json-schema';
import { BaseError } from '../../errors/BaseError.js';
import { MaterializationError } from '../../errors/MaterializationError.js';
import { GraphError } from '../../errors/GraphError.js';
import { isRecord } from '../data/dataTypes.js';
import { SchemaGraph } from '../graph/schemaGraph.js';
import { projectAbox } from '../rdf/projection.js';

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
  private readonly graphCache = new WeakMap<object, SchemaGraphInterface>();

  /**
   * Create a Materializer bound to a schema registry.
   *
   * @param registry - Schema registry for engine and schema lookups
   * @param options - Materializer options (e.g. passAdditionalProperties)
   */
  public constructor(
    private readonly registry: SchemaRegistryInterface,
    private readonly options: MaterializerOptionsInterface = {}
  ) {}

  /**
   * Create a default instance of a schema by synthesizing zero values for required properties.
   *
   * @param schema - Schema object with $id
   * @returns Default value with all required properties filled
   */
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

  private graphFor(rootSchema: JSONSchema7Definition): SchemaGraphInterface {
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

  /**
   * Materialize partial data against a schema, filling implicit properties and validating.
   *
   * @param schema - Schema object with $id
   * @param partial - Partial data to materialize
   * @returns Fully materialized value matching the schema
   * @throws {@link MaterializationError} When the data fails validation
   */
  public materialize<TSchema extends JSONSchema7Definition & { readonly '$id': string; }>(
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

  /**
   * Project validated data into ABox RDF quads for ontology serialization.
   *
   * @param schema - Schema object with $id
   * @param data - Data to project
   * @param baseIRI - Base IRI for generated quad subjects
   * @returns Array of RDF quads representing the ABox projection
   * @throws {@link MaterializationError} When the data fails validation
   */
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
    const quads = projectAbox(execution.graph, materialized, baseIRI, execution.entryNode);

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

    const lookedUp = this.registry.get(schemaId) as JSONSchema7Definition | undefined;

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
      'allowAdditionalProperties': this.options.passAdditionalProperties === true,
      'applyDefaults': true,
      'castTypes': this.registry.castTypes,
      'collectErrors': true,
      'removeAdditionalProperties': false,
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
