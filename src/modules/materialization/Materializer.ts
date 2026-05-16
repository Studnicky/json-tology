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
   * Collect every property the schema effectively carries: own `properties`
   * plus those reachable through `allOf` members (recursively, resolving
   * `$ref` parents that point to other graphs in the registry). Without
   * this walk a `Compose.subClassOf(Parent, body)` schema only materializes
   * the body's own properties; parent fields supplied at the wire level
   * are dropped from the output even though validation accepts them.
   */
  private collectEffectiveProperties(
    graph: SchemaGraphInterface,
    node: SchemaGraphNodeInterface
  ): Map<string, { 'graph': SchemaGraphInterface;
    'node': SchemaGraphNodeInterface }> {
    const collected = new Map<string, { 'graph': SchemaGraphInterface;
      'node': SchemaGraphNodeInterface }>();
    const visited = new Set<SchemaGraphNodeInterface>();

    const walk = (currentGraph: SchemaGraphInterface, current: SchemaGraphNodeInterface): void => {
      if (visited.has(current)) {
        return;
      }
      visited.add(current);

      const [
        resolvedGraph,
        resolvedNode
      ] = this.resolveTargetGraphAndNode(currentGraph, current);
      const semantics = resolvedGraph.semantics(resolvedNode);

      for (const [
        name,
        propNode
      ] of semantics.properties) {
        if (!collected.has(name)) {
          collected.set(name, {
            'graph': resolvedGraph,
            'node': propNode
          });
        }
      }

      for (const member of semantics.allOf) {
        walk(resolvedGraph, member);
      }
    };

    walk(graph, node);

    return collected;
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
    value: unknown,
    visited = new WeakSet()
  ): void {
    if (!isRecord(value)) {
      return;
    }
    if (visited.has(value)) {
      return;
    }
    visited.add(value);

    const [
      resolvedGraph,
      resolvedNode
    ] = this.resolveTargetGraphAndNode(graph, node);
    const propertyNodes = this.collectEffectiveProperties(resolvedGraph, resolvedNode);

    for (const [
      propertyName,
      entry
    ] of propertyNodes) {
      if (!(propertyName in value)) {
        value[propertyName] = undefined;
        continue;
      }

      const propertyValue = value[propertyName];
      const [
        propertyGraph,
        propertyTargetNode
      ] = this.resolveTargetGraphAndNode(entry.graph, entry.node);

      if (Array.isArray(propertyValue)) {
        const itemsNode = propertyGraph.semantics(propertyTargetNode).itemsNode;

        if (itemsNode === undefined) {
          continue;
        }

        for (const item of propertyValue) {
          this.fillImplicitProperties(propertyGraph, itemsNode, item, visited);
        }

        continue;
      }

      this.fillImplicitProperties(propertyGraph, propertyTargetNode, propertyValue, visited);
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

  /**
   * Resolve a node that may carry a $ref into the (graph, node) pair where
   * its semantics actually live. Cross-graph refs are common in the
   * bookstore registry — `subClassOf(Customer, body)` produces a child
   * with `$ref: 'urn:bookstore:Customer'` whose target node belongs to
   * Customer's own graph.
   */
  private resolveTargetGraphAndNode(
    graph: SchemaGraphInterface,
    node: SchemaGraphNodeInterface
  ): [SchemaGraphInterface, SchemaGraphNodeInterface] {
    const semantics = graph.semantics(node);

    if (semantics.ref === undefined) {
      return [
        graph,
        node
      ];
    }

    const ref = semantics.ref;

    if (ref.startsWith('#')) {
      return [
        graph,
        graph.resolveFragment(ref.slice(1))
      ];
    }

    const parsed = GraphEngineSupport.parseRef(ref);
    const targetGraph = this.registry.graph(parsed.id);

    if (targetGraph === undefined) {
      throw new GraphError('REF_UNRESOLVED', `Unresolved schema reference: ${ref}`, ref);
    }

    return [
      targetGraph,
      targetGraph.resolveFragment(parsed.fragment)
    ];
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
