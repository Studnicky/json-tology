import type {
  MaterializationResultType, MaterializerOptionsType
} from '../../types/Materializer.js';
import type { MaterializerInterface } from '../../interfaces/MaterializerInterface.js';
import type { DefaultCreatorInterface } from '../../interfaces/DefaultCreatorInterface.js';
import type { SchemaGraphNodeType } from '../../types/SchemaGraph.js';
import type { QuadInterface } from '../../interfaces/QuadInterface.js';
import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphInterface.js';
import type { SchemaRegistryInterface } from '../../interfaces/SchemaRegistryInterface.js';
import type { InferSchemaType } from '../../types/Infer.js';
import type { AboxOptionsType } from '../../types/AboxOptionsType.js';
import type { JsonSchemaDocumentType } from '../../types/Schema.js';
import type { EffectivePropertyMapType } from '../../types/EffectivePropertyMapType.js';
import type { ValidationErrorType } from '../../types/Validation.js';
import type { LoggerInterface } from '../../interfaces/LoggerInterface.js';
import type { AboxProjectorInterface } from '../../interfaces/AboxProjectorInterface.js';
import { BaseError } from '../../errors/BaseError.js';
import { MaterializationError } from '../../errors/MaterializationError.js';
import {
  InstantiationErrorCode, MaterializationErrorCode
} from '../../constants/ERROR_CODES.js';
import { Frozen } from '../data/Frozen.js';
import { isRecord } from '../data/DataTypes.js';
import { collectEffectivePropertiesMemo } from '../graph/EffectiveProperties.js';
import { resolveRef as canonicalResolveRef } from '../graph/RefResolution.js';
import { GraphEngineDefaults } from '../graph/GraphEngineDefaults.js';
import { Terms } from '../quads/Terms.js';
import { OWL } from '../../constants/IRI.js';
import { ValidationErrors } from '../../errors/ValidationErrors.js';
import { InstantiationError } from '../../errors/InstantiationError.js';
import { SILENT_LOGGER } from '../../constants/LOGGER.js';
import { logScope } from '../data/LogScope.js';

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
 * the `lookupGraphFn` are pre-allocated in the constructor to avoid per-call allocations
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

    if (isRecord(config) && config.frozen === true) {
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
    SchemaGraphNodeType,
    EffectivePropertyMapType
  >();

  private readonly logger: LoggerInterface;

  // Bound once in the constructor; passed as `lookupGraph` to avoid a trivial
  // per-call arrow allocation in projectAboxFromExecution.
  private readonly lookupGraphFn: (schemaId: string) => SchemaGraphInterface | undefined;

  // Pre-bound in the constructor alongside lookupGraphFn; reused across run()
  // calls to avoid a fresh closure allocation on every synthesizeDefaults/
  // allowAdditionalProperties execution path.
  private readonly lookupSchemaFn: (sid: string) => Record<string, unknown> | undefined;

  /**
   * Create a Materializer bound to a schema registry.
   *
   * @param registry - Schema registry for engine and schema lookups
   * @param options - Materializer options (e.g. passAdditionalProperties)
   */
  public constructor(
    private readonly registry: SchemaRegistryInterface,
    options: MaterializerOptionsType = {}
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
    this.lookupGraphFn = (schemaId: string): SchemaGraphInterface | undefined => {
      return registry.graph(schemaId);
    };
    this.lookupSchemaFn = (sid: string): Record<string, unknown> | undefined => {
      const schemaGraph = this.lookupGraphFn(sid);

      if (schemaGraph === undefined || !isRecord(schemaGraph.rootSchema)) {
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
  private appendSameAsQuads(quads: QuadInterface[], graphIRI: string | undefined): void {
    const pairs = this.registry.sameAsStore.all();

    if (pairs.length === 0) {
      return;
    }
    const graphTerm = graphIRI === undefined ? Terms.defaultGraph() : Terms.iri(graphIRI);
    const predicate = Terms.iri(OWL.sameAs);

    for (const [
      a,
      b
    ] of pairs) {
      quads.push(Terms.quad(Terms.iri(a), predicate, Terms.iri(b), graphTerm));
      quads.push(Terms.quad(Terms.iri(b), predicate, Terms.iri(a), graphTerm));
    }
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
            'code': InstantiationErrorCode.INSTANTIATION_FAILED
          }
        );
      }
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
    node: SchemaGraphNodeType
  ): EffectivePropertyMapType {
    return collectEffectivePropertiesMemo(
      this.effectivePropertiesCache,
      graph,
      node,
      (refId: string): SchemaGraphInterface | undefined => {
        return this.registry.graph(refId);
      }
    );
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
  ): MaterializationResultType {
    const baseIRI = options?.baseIRI;
    const synthesize = options?.synthesizeDefaults === true;
    const runResult = this.run(schema, data, baseIRI, synthesize);

    return runResult;
  }

  private fillImplicitProperties(
    graph: SchemaGraphInterface,
    node: SchemaGraphNodeType,
    value: unknown,
    visited = new WeakSet()
  ): void {
    if (!isRecord(value) || visited.has(value)) {
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
    propertyTargetNode: SchemaGraphNodeType,
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

  private formatErrors(errors: ValidationErrorType[]): string[] {
    return BaseError.formatErrors(errors);
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
    partial?: Partial<InferSchemaType<TSchema>>,
  ): InferSchemaType<TSchema>;
  public materialize(
    schema: Record<string, unknown> & { '$id': string; },
    partial?: Record<string, unknown>
  ): unknown {
    const result = this.run(schema, partial ?? {});

    if (!result.valid) {
      throw new MaterializationError(schema.$id, {
        'code': MaterializationErrorCode.MATERIALIZATION_FAILED,
        'validationErrors': result.errors
      });
    }

    const value = result.value;

    if (isRecord(value)) {
      this.applyComputedFields(schema.$id, value);
    }

    this.logger.info(logScope('Materializer', 'materialize', `materialization complete for ${schema.$id}`));

    if (Materializer.isEffectivelyFrozen(schema)) {
      return Frozen.deepFreeze(value);
    }

    return value;
  }
  private materializeResult(
    graph: SchemaGraphInterface,
    entryNode: SchemaGraphNodeType,
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
   * @param baseIRI - Base IRI for generated quad subjects
   * @param options - Optional overrides: `iriFor` mints subject IRIs per object;
   *                  `graphIRI` sets the graph field on all quads;
   *                  `curie` expands CURIE prefixes in predicates;
   *                  `predicateResolver` overrides predicate IRI resolution
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
      throw new MaterializationError(schema.$id, {
        'code': MaterializationErrorCode.MATERIALIZATION_FAILED,
        'validationErrors': result.errors
      });
    }

    return result.abox;
  }

  private projectAboxFromExecution(
    graph: SchemaGraphInterface,
    entryNode: SchemaGraphNodeType,
    materialized: unknown,
    baseIRI: string,
    options?: AboxOptionsType
  ): QuadInterface[] {
    if (this.aboxProjector === undefined) {
      throw new MaterializationError(
        entryNode.id,
        {
          'code': MaterializationErrorCode.MATERIALIZATION_FAILED,
          'message': 'ABox projection requires an aboxProjector. Construct the Materializer with { aboxProjector } (the facade injects Projection) so this layer need not import rdf/.',
          'validationErrors': ['no aboxProjector injected into Materializer']
        }
      );
    }

    const quads = this.aboxProjector.abox(graph, materialized, baseIRI, {
      'annotationEmitMode': options?.annotationEmitMode,
      'curie': options?.curie,
      entryNode,
      'graphIRI': options?.graphIRI,
      'iriFor': options?.iriFor,
      'lookupGraph': this.lookupGraphFn,
      'predicateResolver': options?.predicateResolver
    });

    this.appendSameAsQuads(quads, options?.graphIRI);

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
    node: SchemaGraphNodeType
  ): [SchemaGraphInterface, SchemaGraphNodeType] {
    const semantics = graph.semantics(node);

    if (semantics.ref === undefined) {
      return [
        graph,
        node
      ];
    }

    try {
      const resolved = canonicalResolveRef(semantics.ref, graph, { 'lookupGraph': this.lookupGraphFn });

      return [
        resolved.graph,
        resolved.node
      ];
    } catch (error) {
      this.logger.error(logScope('Materializer', 'resolveTargetGraphAndNode', `ref resolution failed for "${semantics.ref}"`));
      throw error;
    }
  }

  private run(
    schema: Record<string, unknown> & { '$id': string; },
    data: unknown,
    baseIRI?: string,
    synthesizeDefaults = false,
    aboxOptions?: AboxOptionsType
  ): MaterializationResultType {
    const id = schema.$id;

    if (!this.registry.has(id)) {
      this.registry.set(schema);
    }

    if (synthesizeDefaults || this.allowAdditionalProperties) {
      const graph = this.registry.graph(id);

      if (graph === undefined) {
        throw new MaterializationError(id, {
          'code': MaterializationErrorCode.MATERIALIZATION_FAILED,
          'validationErrors': [`No graph found for schema: ${id}`]
        });
      }

      const entryNode = graph.rootNode;

      const opts = synthesizeDefaults ? this.cachedOverridesWithDefaults : this.cachedOverridesNoDefaults;
      const validator = this.registry.validator(id);
      const seedData = synthesizeDefaults && data === undefined
        ? GraphEngineDefaults.synthesizeZeroValueForLookups(entryNode, graph, this.lookupSchemaFn, this.lookupGraphFn)
        : data;
      const compiledResult = validator.validate(seedData, opts);

      const materialized = synthesizeDefaults
        ? compiledResult.value
        : this.materializeResult(graph, entryNode, compiledResult.value);
      const abox = baseIRI === undefined
        ? []
        : this.projectAboxFromExecution(graph, entryNode, materialized, baseIRI, aboxOptions);

      const errors = this.formatErrors(compiledResult.errors);

      if (!compiledResult.valid) {
        this.logger.warn(logScope('Materializer', 'run', `materialization failed with ${errors.length} error(s)`));
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
        'code': MaterializationErrorCode.MATERIALIZATION_FAILED,
        'validationErrors': [`No graph found for schema: ${id}`]
      });
    }

    const entryNode = graph.rootNode;
    const materialized = this.materializeResult(graph, entryNode, compiledResult.value);

    const abox = baseIRI === undefined
      ? []
      : this.projectAboxFromExecution(graph, entryNode, materialized, baseIRI, aboxOptions);

    const errors = this.formatErrors(compiledResult.errors);

    if (!compiledResult.valid) {
      this.logger.warn(logScope('Materializer', 'run', `materialization failed with ${errors.length} error(s)`));
    }

    return {
      abox,
      errors,
      'valid': compiledResult.valid,
      'value': materialized
    };
  }
}
