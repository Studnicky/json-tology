import type { SchemaGraphNodeInterface } from '../../interfaces/SchemaGraphNodeInterface.js';
import type { MaterializationResultInterface } from '../../interfaces/MaterializationResultInterface.js';
import type { MaterializerOptionsInterface } from '../../interfaces/MaterializerOptionsInterface.js';
import type { MaterializerRunOptionsInterface } from '../../interfaces/MaterializerRunOptionsInterface.js';
import type { MaterializerInterface } from '../../interfaces/MaterializerInterface.js';
import type { DefaultCreatorInterface } from '../../interfaces/DefaultCreatorInterface.js';
import type { QuadInterface } from '../../interfaces/QuadInterface.js';
import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphInterface.js';
import type { SchemaRegistryInterface } from '../../interfaces/SchemaRegistryInterface.js';
import type { InferSchemaType } from '../../types/Infer.js';
import type { AboxOptionsInterface } from '../../interfaces/AboxOptionsInterface.js';
import type { JsonSchemaDocumentType } from '../../types/Schema.js';
import type { EffectivePropertyMapInterface } from '../../interfaces/EffectivePropertyMapInterface.js';
import type { ValidationErrorEntity } from '../../entities/ValidationErrorEntity.js';
import type { LoggerInterface } from '../../interfaces/LoggerInterface.js';
import type { AboxProjectorInterface } from '../../interfaces/AboxProjectorInterface.js';
import type { ComputedFunctionInterface } from '../../interfaces/ComputedFunctionInterface.js';
import type { MaterializerExecuteOptionsEntity } from '../../entities/MaterializerExecuteOptionsEntity.js';
import type { PartialInferSchemaType } from '../../types/PartialInferSchemaType.js';
import { BaseError } from '../../errors/BaseError.js';
import { MaterializationError } from '../../errors/MaterializationError.js';
import {
  INSTANTIATION_ERROR_CODE, MATERIALIZATION_ERROR_CODE
} from '../../constants/ERROR_CODES.js';
import { Frozen } from '../data/Frozen.js';
import { DataType } from '../data/DataType.js';
import { EffectiveProperties } from '../graph/EffectiveProperties.js';
import { ReferenceResolution } from '../graph/ReferenceResolution.js';
import { GraphEngineDefaults } from '../graph/GraphEngineDefaults.js';
import { Terms } from '../quads/Terms.js';
import { OWL } from '../../constants/IRI.js';
import { ValidationErrors } from '../../errors/ValidationErrors.js';
import { InstantiationError } from '../../errors/InstantiationError.js';
import { SILENT_LOGGER } from '../../constants/LOGGER.js';
import { LogScope } from '../data/LogScope.js';

/**
 * Materializer — runtime projection over validation execution results.
 *
 * The runtime contract has three disciplined stages:
 *
 * 1. **Validation execution** — validates data against the canonical graph via the compiled validator, applying defaults, coercion, and zero-value synthesis during traversal.
 *
 * 2. **Materialization** (`materialize()`) — projects validation execution output
 *    into a fully-populated JS value with implicit properties filled.
 *
 * 3. **ABox projection** (`projectAbox()`) — projects materialized state into
 *    RDF quads that can be serialized with the same ontology tooling as TBox output.
 *
 * `createDefault()` uses the same execution engine with `synthesizeDefaults: true`,
 * generating zero values for required properties that lack explicit defaults instead
 * of reporting validation errors. `materialize()` runs with `synthesizeDefaults: false`.
 *
 * @remarks
 * The Materializer is bound to a {@link SchemaRegistryInterface} at construction time.
 * Execution overrides (`cachedOverridesNoDefaults`, `cachedOverridesWithDefaults`) and
 * the `lookupGraphFunction` are pre-allocated in the constructor to avoid per-call allocations
 * on the hot materialization path.
 *
 * @example
 * ```ts
 * const mat = new Materializer(registry);
 * const user = mat.materialize(UserSchema, { name: 'Alice' });
 * ```
 *
 * @category Materialization
 * @since 0.1.0
 * @see {@link SchemaRegistryInterface}
 * @group Runtime
 */
export class Materializer implements DefaultCreatorInterface, MaterializerInterface {
  private static isEffectivelyFrozen(schema: Record<string, unknown>): boolean {
    if (schema['jt:frozen'] === true) {
      return true;
    }
    const config = schema['jt:config'];

    if (DataType.isRecord(config) && config.frozen === true) {
      return true;
    }

    return false;
  }

  // Injected by the facade (JsonTology) so this layer need not import rdf/.
  // undefined when no projector was supplied — ABox projection then errors.
  private readonly aboxProjector: AboxProjectorInterface | undefined;

  // When true, additionalProperties:false enforcement is bypassed via ignoreAdditionalProperties.
  private readonly allowAdditionalProperties: boolean;

  private readonly cachedOverridesNoDefaults: {
    readonly 'applyDefaults': true;
    readonly 'castTypes': boolean;
    readonly 'collectErrors': true;
    readonly 'ignoreAdditionalProperties': boolean;
    readonly 'removeAdditionalProperties': false;
    readonly 'synthesizeDefaults': false;
  };

  private readonly cachedOverridesWithDefaults: {
    readonly 'applyDefaults': true;
    readonly 'castTypes': boolean;
    readonly 'collectErrors': true;
    readonly 'ignoreAdditionalProperties': boolean;
    readonly 'removeAdditionalProperties': false;
    readonly 'synthesizeDefaults': true;
  };

  // Node-keyed WeakMap: node → collected effective-property map.
  // Schema nodes are stable post-registration and each node has a unique identity
  // within its home graph, so keying by node is safe. The cache is automatically
  // invalidated when nodes are GC'd.
  private readonly effectivePropertiesCache = new WeakMap<
    SchemaGraphNodeInterface,
    EffectivePropertyMapInterface
  >();

  private readonly logger: LoggerInterface;

  // Bound once in the constructor; passed as `lookupGraph` to avoid a trivial
  // per-call arrow allocation in projectAboxFromExecution.
  private readonly lookupGraphFunction: (schemaId: string) => SchemaGraphInterface | undefined;

  // Pre-bound in the constructor alongside lookupGraphFunction; reused across run()
  // calls to avoid a fresh closure allocation on every synthesizeDefaults/
  // allowAdditionalProperties execution path.
  private readonly lookupSchemaFunction: (sid: string) => Record<string, unknown> | undefined;

  /**
   * Create a Materializer bound to a schema registry.
   *
   * @param registry - Schema registry for engine and schema lookups
   * @param options - Materializer options (e.g. passAdditionalProperties)
   */
  public constructor(
    private readonly registry: SchemaRegistryInterface,
    options: MaterializerOptionsInterface = {}
  ) {
    const allowAdditionalProperties = options.passAdditionalProperties === true;
    const castTypes = registry.castTypes;

    this.aboxProjector = options.aboxProjector;
    this.allowAdditionalProperties = allowAdditionalProperties;
    this.logger = options.logger ?? SILENT_LOGGER;

    this.cachedOverridesNoDefaults = {
      'applyDefaults': true,
      'castTypes': castTypes,
      'collectErrors': true,
      'ignoreAdditionalProperties': allowAdditionalProperties,
      'removeAdditionalProperties': false,
      'synthesizeDefaults': false
    };
    this.cachedOverridesWithDefaults = {
      'applyDefaults': true,
      'castTypes': castTypes,
      'collectErrors': true,
      'ignoreAdditionalProperties': allowAdditionalProperties,
      'removeAdditionalProperties': false,
      'synthesizeDefaults': true
    };
    this.lookupGraphFunction = (schemaId: string): SchemaGraphInterface | undefined => {
      const result = registry.graph(schemaId);

      return result;
    };
    this.lookupSchemaFunction = (sid: string): Record<string, unknown> | undefined => {
      const schemaGraph = this.lookupGraphFunction(sid);

      if (schemaGraph === undefined || !DataType.isRecord(schemaGraph.rootSchema)) {
        return undefined;
      }

      return schemaGraph.rootSchema;
    };
  }

  /**
   * Append symmetric owl:sameAs quads from the registry's SameAsStore to an
   * ABox projection. Called automatically by projectAbox so direct callers and
   * the JsonTology.toQuads facade emit equivalent output — there is no bypass.
   */
  private appendSameAsQuads(quads: QuadInterface[], graphIri: string | undefined): void {
    const pairs = this.registry.sameAsStore.all();

    if (pairs.length === 0) {
      return;
    }
    const graphTerm = graphIri === undefined ? Terms.defaultGraph() : Terms.iri(graphIri);
    const predicate = Terms.iri(OWL.sameAs);

    for (const [
      a,
      b
    ] of pairs) {
      quads.push(Terms.quad(Terms.iri(a), predicate, Terms.iri(b), graphTerm));
      quads.push(Terms.quad(Terms.iri(b), predicate, Terms.iri(a), graphTerm));
    }
  }

  private applyComputedField(
    name: string,
    computeFunction: ComputedFunctionInterface,
    value: Record<string, unknown>
  ): void {
    try {
      value[name] = computeFunction(value);
    } catch (error) {
      const causeError = BaseError.toCause(error);

      throw new InstantiationError(
        new ValidationErrors([{
          'keyword': 'COMPUTED_FN_MISSING',
          'message': `Compute function for "${name}" threw: ${causeError.message}`,
          'params': {},
          'path': `/${name}`
        }]),
        {
          'cause': causeError,
          'code': INSTANTIATION_ERROR_CODE.INSTANTIATION_FAILED
        }
      );
    }
  }

  private applyComputedFields(schemaId: string, value: Record<string, unknown>): void {
    const computedMap = this.registry.computedStore.getMap(schemaId);

    for (const [
      name,
      computeFunction
    ] of Object.entries(computedMap)) {
      this.applyComputedField(name, computeFunction, value);
    }
  }

  /**
   * Collect every property the schema effectively carries: own `properties`
   * plus those reachable through `allOf` members and if/then/else conditional
   * branches (recursively, resolving `$ref` parents that point to other graphs
   * in the registry). Without this walk a `Compose.subClassOf(Parent, body)`
   * schema only materializes the body's own properties; parent fields supplied
   * at the wire level are dropped from the output even though validation accepts
   * them. Conditional-branch properties (then/else) are now also included so
   * they survive `fillImplicitProperties`.
   *
   * Delegates to the canonical `collectEffectivePropertiesMemo` walker with a
   * `resolveGraph` backed by the registry and a node-keyed instance cache.
   */
  private collectEffectiveProperties(
    graph: SchemaGraphInterface,
    node: SchemaGraphNodeInterface
  ): EffectivePropertyMapInterface {
    const result = EffectiveProperties.collectMemo(
      this.effectivePropertiesCache,
      graph,
      node,
      (referenceId: string): SchemaGraphInterface | undefined => {
        const referenceGraph = this.registry.graph(referenceId);

        return referenceGraph;
      }
    );

    return result;
  }

  /**
   * Create a default instance of a schema by synthesizing zero values for required properties.
   *
   * @param schema - Schema object with $id
   * @returns Default value with all required properties filled
   */
  public createDefault(schema: Record<string, unknown> & { '$id': string }): unknown {
    const result = this.run(schema, undefined, { 'synthesizeDefaults': true });

    return result.value;
  }

  /**
   * Execute materialization and return the full result without throwing.
   * The caller decides what to use from the output.
   */
  public execute(
    schema: Record<string, unknown> & { '$id': string },
    options?: MaterializerExecuteOptionsEntity.Type
  ): MaterializationResultInterface {
    const data = options?.data;
    const baseIri = options?.baseIri;
    const synthesize = options?.synthesizeDefaults === true;
    const runResult = baseIri === undefined
      ? this.run(schema, data, { 'synthesizeDefaults': synthesize })
      : this.run(schema, data, {
        baseIri,
        'synthesizeDefaults': synthesize
      });

    return runResult;
  }

  private fillImplicitProperties(
    graph: SchemaGraphInterface,
    node: SchemaGraphNodeInterface,
    value: unknown,
    visited = new WeakSet()
  ): void {
    if (!DataType.isRecord(value) || visited.has(value)) {
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

      this.fillImplicitProperty(propertyGraph, propertyTargetNode, propertyValue, visited);
    }
  }

  private fillImplicitProperty(
    propertyGraph: SchemaGraphInterface,
    propertyTargetNode: SchemaGraphNodeInterface,
    propertyValue: unknown,
    visited: WeakSet<WeakKey>
  ): void {
    if (Array.isArray(propertyValue)) {
      const itemsNode = propertyGraph.semantics(propertyTargetNode).itemsNode;

      if (itemsNode === undefined) {
        return;
      }

      for (const item of propertyValue) {
        this.fillImplicitProperties(propertyGraph, itemsNode, item, visited);
      }

      return;
    }

    this.fillImplicitProperties(propertyGraph, propertyTargetNode, propertyValue, visited);
  }

  private formatErrors(errors: ValidationErrorEntity.Type[]): string[] {
    const result = BaseError.formatErrors(errors);

    return result;
  }

  /**
   * Materialize partial data against a schema, filling implicit properties and validating.
   *
   * @param schema - Schema object with $id
   * @param partial - Partial data to materialize
   * @returns Fully materialized value matching the schema
   * @throws {@link MaterializationError} When the data fails validation
   */
  public materialize<TSchema extends JsonSchemaDocumentType & { readonly '$id': string; }>(
    schema: TSchema,
    partial?: PartialInferSchemaType<TSchema>,
  ): InferSchemaType<TSchema>;
  public materialize(
    schema: Record<string, unknown> & { '$id': string; },
    partial?: Record<string, unknown>
  ): unknown {
    const result = this.run(schema, partial ?? {});

    if (!result.valid) {
      throw new MaterializationError(schema.$id, {
        'code': MATERIALIZATION_ERROR_CODE.MATERIALIZATION_FAILED,
        'validationErrors': result.errors
      });
    }

    const value = result.value;

    if (DataType.isRecord(value)) {
      this.applyComputedFields(schema.$id, value);
    }

    this.logger.info(LogScope.format('Materializer', 'materialize', `materialization complete for ${schema.$id}`));

    if (Materializer.isEffectivelyFrozen(schema)) {
      return Frozen.deepFreeze(value);
    }

    return value;
  }
  private materializeResult(
    graph: SchemaGraphInterface,
    entryNode: SchemaGraphNodeInterface,
    value: unknown
  ): unknown {
    this.fillImplicitProperties(graph, entryNode, value);

    return value;
  }

  /**
   * Project validated data into ABox RDF quads for ontology serialization.
   *
   * Runs the engine, validates the result, then projects ABox quads. Internally
   * calls `appendSameAsQuads` so direct callers receive the same symmetric
   * `owl:sameAs` assertions emitted by the `JsonTology.toQuads()` facade —
   * there is no bypass; both paths produce equivalent output.
   *
   * @param schema - Schema object with $id
   * @param data - Data to project
   * @param baseIri - Base IRI for generated quad subjects
   * @param options - Optional overrides: `iriFor` mints subject IRIs per object;
   *                  `graphIri` sets the graph field on all quads;
   *                  `curie` expands CURIE prefixes in predicates;
   *                  `predicateResolver` overrides predicate IRI resolution
   * @returns Array of RDF quads representing the ABox projection
   * @throws {@link MaterializationError} When the data fails validation
   */
  public projectAbox(
    schema: Record<string, unknown> & { '$id': string; },
    data: unknown,
    baseIri: string,
    options?: AboxOptionsInterface
  ): QuadInterface[] {
    const result = options === undefined
      ? this.run(schema, data, {
        baseIri,
        'synthesizeDefaults': false
      })
      : this.run(schema, data, {
        'aboxOptions': options,
        baseIri,
        'synthesizeDefaults': false
      });

    if (!result.valid) {
      throw new MaterializationError(schema.$id, {
        'code': MATERIALIZATION_ERROR_CODE.MATERIALIZATION_FAILED,
        'validationErrors': result.errors
      });
    }

    return result.abox;
  }

  private projectAboxFromExecution(
    graph: SchemaGraphInterface,
    entryNode: SchemaGraphNodeInterface,
    materialized: unknown,
    baseIri: string,
    options?: AboxOptionsInterface
  ): QuadInterface[] {
    if (this.aboxProjector === undefined) {
      throw new MaterializationError(
        entryNode.id,
        {
          'code': MATERIALIZATION_ERROR_CODE.MATERIALIZATION_FAILED,
          'message': 'ABox projection requires an aboxProjector. Construct the Materializer with { aboxProjector } (the facade injects Projection) so this layer need not import rdf/.',
          'validationErrors': ['no aboxProjector injected into Materializer']
        }
      );
    }

    const quads = this.aboxProjector.abox(graph, materialized, baseIri, {
      'annotationEmitMode': options?.annotationEmitMode,
      'curie': options?.curie,
      entryNode,
      'graphIri': options?.graphIri,
      'iriFor': options?.iriFor,
      'lookupGraph': this.lookupGraphFunction,
      'predicateResolver': options?.predicateResolver
    });

    this.appendSameAsQuads(quads, options?.graphIri);

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

    try {
      const resolved = ReferenceResolution.resolve(semantics.ref, graph, {
        'logger': this.logger,
        'lookupGraph': this.lookupGraphFunction
      });

      return [
        resolved.graph,
        resolved.node
      ];
    } catch (error) {
      this.logger.error(LogScope.format('Materializer', 'resolveTargetGraphAndNode', `ref resolution failed for "${semantics.ref}"`));
      throw error;
    }
  }

  private run(
    schema: Record<string, unknown> & { '$id': string; },
    data: unknown,
    options: MaterializerRunOptionsInterface = {}
  ): MaterializationResultInterface {
    const {
      aboxOptions, baseIri, synthesizeDefaults = false
    } = options;
    const id = schema.$id;

    if (!this.registry.has(id)) {
      this.registry.set(schema);
    }

    if (synthesizeDefaults || this.allowAdditionalProperties) {
      const graph = this.registry.graph(id);

      if (graph === undefined) {
        throw new MaterializationError(id, {
          'code': MATERIALIZATION_ERROR_CODE.MATERIALIZATION_FAILED,
          'validationErrors': [`No graph found for schema: ${id}`]
        });
      }

      const entryNode = graph.rootNode;

      const validateOptions = synthesizeDefaults ? this.cachedOverridesWithDefaults : this.cachedOverridesNoDefaults;
      const validator = this.registry.validator(id);
      const seedData = synthesizeDefaults && data === undefined
        ? GraphEngineDefaults.synthesizeZeroValueForLookups(entryNode, graph, this.lookupSchemaFunction, this.lookupGraphFunction)
        : data;
      const compiledResult = validator.validate(seedData, validateOptions);

      const materialized = synthesizeDefaults
        ? compiledResult.value
        : this.materializeResult(graph, entryNode, compiledResult.value);
      const abox = baseIri === undefined
        ? []
        : this.projectAboxFromExecution(graph, entryNode, materialized, baseIri, aboxOptions);

      const errors = this.formatErrors(compiledResult.errors);

      if (!compiledResult.valid) {
        this.logger.warn(LogScope.format('Materializer', 'run', `materialization failed with ${errors.length} error(s)`));
      }

      return {
        abox,
        errors,
        'valid': compiledResult.valid,
        'value': materialized
      };
    }

    // Default materialization path — compiled validator with defaults and coercion applied.
    const validator = this.registry.validator(id);
    const compiledResult = validator.validate(data, this.cachedOverridesNoDefaults);

    const graph = this.registry.graph(id);

    if (graph === undefined) {
      throw new MaterializationError(id, {
        'code': MATERIALIZATION_ERROR_CODE.MATERIALIZATION_FAILED,
        'validationErrors': [`No graph found for schema: ${id}`]
      });
    }

    const entryNode = graph.rootNode;
    const materialized = this.materializeResult(graph, entryNode, compiledResult.value);

    const abox = baseIri === undefined
      ? []
      : this.projectAboxFromExecution(graph, entryNode, materialized, baseIri, aboxOptions);

    const errors = this.formatErrors(compiledResult.errors);

    if (!compiledResult.valid) {
      this.logger.warn(LogScope.format('Materializer', 'run', `materialization failed with ${errors.length} error(s)`));
    }

    return {
      abox,
      errors,
      'valid': compiledResult.valid,
      'value': materialized
    };
  }
}
