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
import type { AboxOptionsType } from '../../types/AboxOptions.js';
import type { JSONSchema7Definition } from 'json-schema';
import { BaseError } from '../../errors/BaseError.js';
import { MaterializationError } from '../../errors/MaterializationError.js';
import { GraphError } from '../../errors/GraphError.js';
import { Frozen } from '../data/Frozen.js';
import { isRecord } from '../data/DataTypes.js';
import { GraphEngineSupport } from '../graph/GraphEngineSupport.js';
import { Projection } from '../rdf/Projection.js';
import { ValidationErrors } from '../../errors/ValidationErrors.js';
import { InstantiationError } from '../../errors/InstantiationError.js';

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
  private static isEffectivelyFrozen(schema: Record<string, unknown>): boolean {
    if (schema['jt:frozen'] === true) {
      return true;
    }
    const config = schema['jt:config'];

    if (isRecord(config) && config.frozen === true) {
      return true;
    }

    return false;
  }

  /**
   * Create a Materializer bound to a schema registry.
   *
   * @param registry - Schema registry for engine and schema lookups
   * @param options - Materializer options (e.g. passAdditionalProperties)
   */
  private readonly cachedOverridesNoDefaults: {
    readonly 'allowAdditionalProperties': boolean;
    readonly 'applyDefaults': true;
    readonly 'castTypes': boolean;
    readonly 'collectErrors': true;
    readonly 'removeAdditionalProperties': false;
    readonly 'synthesizeDefaults': false;
  };

  private readonly cachedOverridesWithDefaults: {
    readonly 'allowAdditionalProperties': boolean;
    readonly 'applyDefaults': true;
    readonly 'castTypes': boolean;
    readonly 'collectErrors': true;
    readonly 'removeAdditionalProperties': false;
    readonly 'synthesizeDefaults': true;
  };

  public constructor(
    private readonly registry: SchemaRegistryInterface,
    options: MaterializerOptionsInterface = {}
  ) {
    const allowAdditionalProperties = options.passAdditionalProperties === true;
    const castTypes = registry.castTypes;

    this.cachedOverridesNoDefaults = {
      'allowAdditionalProperties': allowAdditionalProperties,
      'applyDefaults': true,
      'castTypes': castTypes,
      'collectErrors': true,
      'removeAdditionalProperties': false,
      'synthesizeDefaults': false
    };
    this.cachedOverridesWithDefaults = {
      'allowAdditionalProperties': allowAdditionalProperties,
      'applyDefaults': true,
      'castTypes': castTypes,
      'collectErrors': true,
      'removeAdditionalProperties': false,
      'synthesizeDefaults': true
    };
  }

  private applyComputedFields(schemaId: string, value: Record<string, unknown>): void {
    const computedMap = this.registry.computedStore.getMap(schemaId);

    for (const [
      name,
      fn
    ] of Object.entries(computedMap)) {
      try {
        value[name] = fn(value);
      } catch (error) {
        const causeError = error instanceof Error ? error : new Error(String(error));

        throw new InstantiationError(
          new ValidationErrors([{
            'keyword': 'COMPUTED_FN_MISSING',
            'message': `Compute function for "${name}" threw: ${causeError.message}`,
            'params': {},
            'path': `/${name}`
          }]),
          { 'cause': causeError }
        );
      }
    }
  }

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

    const value = result.value;

    if (isRecord(value)) {
      this.applyComputedFields(schema.$id, value);
    }

    if (Materializer.isEffectivelyFrozen(schema)) {
      return Frozen.deepFreeze(value);
    }

    return value;
  }

  private materializeResult(result: GraphExecutionResultInterface): unknown {
    this.fillImplicitProperties(result.graph, result.entryNode, result.value);

    return result.value;
  }

  /**
   * Project validated data into ABox RDF quads for ontology serialization.
   *
   * @param schema - Schema object with $id
   * @param data - Data to project
   * @param baseIRI - Base IRI for generated quad subjects
   * @param options - Optional overrides: iriFor mints subject IRIs per object;
   *                  graphIRI sets the graph field on all quads
   * @returns Array of RDF quads representing the ABox projection
   * @throws {@link MaterializationError} When the data fails validation
   */
  public projectAbox(
    schema: Record<string, unknown> & { '$id': string; },
    data: unknown,
    baseIRI: string,
    options?: AboxOptionsType
  ): QuadInterface[] {
    const result = this.run(schema, data, baseIRI, false, options);

    if (!result.valid) {
      throw new MaterializationError(schema.$id, result.errors);
    }

    return result.abox;
  }

  private projectAboxFromExecution(
    execution: GraphExecutionResultInterface,
    materialized: unknown,
    baseIRI: string,
    options?: AboxOptionsType
  ): QuadInterface[] {
    const quads = Projection.abox(execution.graph, materialized, baseIRI, {
      'entryNode': execution.entryNode,
      'graphIRI': options?.graphIRI,
      'iriFor': options?.iriFor
    });

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

    const parsed = GraphEngineSupport.parseRef(ref);

    const targetGraph = this.registry.graph(parsed.id);

    if (targetGraph === undefined) {
      throw new GraphError('REF_UNRESOLVED', `Unresolved schema reference: ${ref}`, ref);
    }

    return targetGraph.resolveFragment(parsed.fragment);
  }

  private run(
    schema: Record<string, unknown> & { '$id': string; },
    data: unknown,
    baseIRI?: string,
    synthesizeDefaults = false,
    aboxOptions?: AboxOptionsType
  ): MaterializationResultInterface {
    const id = schema.$id;

    if (!this.registry.has(id)) {
      this.registry.set(schema);
    }

    const engine = this.registry.engine(schema);
    const execution = engine.execute(data, { 'overrides': synthesizeDefaults ? this.cachedOverridesWithDefaults : this.cachedOverridesNoDefaults });
    const materialized = synthesizeDefaults
      ? execution.value
      : this.materializeResult(execution);

    const abox = baseIRI === undefined
      ? []
      : this.projectAboxFromExecution(execution, materialized, baseIRI, aboxOptions);

    return {
      abox,
      'errors': this.formatErrors(execution),
      'valid': execution.valid,
      'value': materialized
    };
  }
}
