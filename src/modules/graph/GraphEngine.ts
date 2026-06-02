import type { ValidationErrorType } from '../../types/Validation.js';
import type {
  GraphEngineOptionsInterface, GraphExecutionResultInterface,
  KeywordDefinitionInterface
} from '../../interfaces/GraphEngine.js';
import type { GraphEngineInterface } from '../../interfaces/GraphEngineImpl.js';
import type {
  SchemaGraphNodeInterface, SchemaGraphSemanticsInterface
} from '../../interfaces/SchemaGraph.js';
import type { FormatRegistryInterface } from '../../interfaces/FormatRegistry.js';
import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphImpl.js';
import type { EffectiveOptionsType } from '../../types/EffectiveOptions.js';

import {
  deepEqual, isRecord
} from '../data/DataTypes.js';
import { FormatRegistry } from '../format/FormatRegistry.js';
import { SchemaGraph } from './SchemaGraph.js';
import { GraphError } from '../../errors/GraphError.js';
import { DEFAULT_OPTIONS } from '../../constants/DIALECT.js';
import { GraphEngineSupport } from './GraphEngineSupport.js';
import { SchemaGraphSupport } from './SchemaGraphSupport.js';
import type { DynamicScopeEntryInterface } from '../../interfaces/DynamicScopeEntry.js';
import type { InternalExecutionResultInterface } from '../../interfaces/InternalExecutionResult.js';
import type { RefTargetInterface } from '../../interfaces/RefTarget.js';
import type { RootDialectPlanInterface } from '../../interfaces/RootDialectPlan.js';
import { GraphEngineScalars } from './GraphEngineScalars.js';
import { BaseError } from '../../errors/BaseError.js';
import { GraphEngineDefaults } from './GraphEngineDefaults.js';
import type { DefaultResolutionContextInterface } from '../../interfaces/DefaultResolutionContext.js';
import { GraphEngineVisit } from './GraphEngineVisit.js';
import type { VisitContextInterface } from '../../interfaces/VisitContext.js';

import type { JsonSchemaDocumentType } from '../../types/Schema.js';

const escape = (segment: string): string => {
  return SchemaGraphSupport.escapeJsonPointerSegment(segment);
};

// Module-level singletons for boundary results — never mutated, safe to share.
const EMPTY_EVALUATED_ITEMS = new Set<number>();
const EMPTY_EVALUATED_PROPERTIES = new Set<string>();

/**
 * Core validation and execution engine for compiled JSON Schema graphs.
 *
 * `GraphEngine` traverses the canonical schema graph produced by `SchemaGraph`
 * and evaluates an input value against it, returning errors, coerced values,
 * and evaluated-property/item sets.  It is the runtime peer of `SchemaGraph`:
 * where `SchemaGraph` constructs the graph, `GraphEngine` walks it.
 *
 * @remarks
 * Instantiate once per root schema and reuse across calls.  The engine caches
 * the compiled graph, regex patterns, and ref resolutions internally so repeated
 * `execute` / `check` / `errors` calls on the same schema are cheap.
 *
 * Customise behaviour via `GraphEngineOptionsInterface`: plug in a custom
 * `FormatRegistry`, register additional keywords, enable coercion, control
 * default application, and supply cross-schema lookup callbacks.
 *
 * @example
 * ```ts
 * const engine = new GraphEngine({ $id: 'https://example.com/Book', type: 'object', required: ['title'] });
 * const { valid, errors } = engine.execute({ title: 'Dune' });
 * ```
 *
 * @category Validation
 * @since 0.1.0
 * @see {@link GraphEngineInterface}
 * @group Graph
 */
export class GraphEngine implements GraphEngineInterface {
  private readonly cachedDefaultResolutionContext: DefaultResolutionContextInterface;
  private readonly cachedVisitContext: VisitContextInterface;
  private readonly customKeywords: KeywordDefinitionInterface[];
  private readonly dialectPlan: RootDialectPlanInterface;
  private readonly embeddedSchemas: Map<string, JsonSchemaDocumentType>;
  public readonly formatRegistry: FormatRegistryInterface;
  private readonly graphCache = new WeakMap<object, SchemaGraph>();
  private readonly options: EffectiveOptionsType;
  private readonly patternEntryCache = new WeakMap<SchemaGraphNodeInterface, Array<{ 'node': SchemaGraphNodeInterface;
    'pattern': string;
    'regex': RegExp }>>();
  private readonly refCache = new Map<string, RefTargetInterface>();
  private readonly refCacheOwn = new Map<string, RefTargetInterface>();
  private readonly regexCache = new Map<string, RegExp>();
  /** Reusable per-engine dynamicScope — guaranteed empty at execute() entry; always reset before use. */
  private readonly reusableDynamicScope: DynamicScopeEntryInterface[] = [];
  /** Reusable per-engine refStack — guaranteed empty at execute() entry; add/delete are balanced. */
  private readonly reusableRefStack = new Set<string>();
  private readonly rootId: string | undefined;

  public constructor(public readonly rootSchema: JsonSchemaDocumentType, options: GraphEngineOptionsInterface = {}) {
    const {
      formatRegistry, keywords, ...rest
    } = options;

    this.formatRegistry = formatRegistry ?? FormatRegistry.builtin();
    this.customKeywords = keywords ?? [];
    this.options = {
      ...DEFAULT_OPTIONS,
      ...rest
    };
    this.dialectPlan = GraphEngineSupport.buildRootDialectPlan(rootSchema);
    this.embeddedSchemas = new Map<string, JsonSchemaDocumentType>();
    GraphEngineSupport.collectEmbeddedSchemas(rootSchema, this.embeddedSchemas, true);
    this.rootId = GraphEngineSupport.schemaId(rootSchema);
    this.cachedDefaultResolutionContext = this.defaultResolutionContext();
    this.cachedVisitContext = this.visitContext();
  }

  private applyAdditionalProperty(
    key: string,
    additionalPropertiesNode: boolean | SchemaGraphNodeInterface | undefined,
    graph: SchemaGraphInterface,
    workingValue: Record<string, unknown>,
    path: string,
    options: EffectiveOptionsType,
    refStack: Set<string>,
    dynamicScope: DynamicScopeEntryInterface[],
    evaluatedProperties: Set<string>,
    errors: ValidationErrorType[],
    depth: number
  ): void {
    if (options.allowAdditionalProperties) {
      return;
    }
    if (additionalPropertiesNode === false) {
      if (options.removeAdditionalProperties) {
        delete workingValue[key];
      } else {
        errors.push(this.createError(`${path}/${escape(key)}`, 'additionalProperties', 'must NOT have additional properties', { 'additionalProperty': key }));
      }

      return;
    }
    if (additionalPropertiesNode === undefined || additionalPropertiesNode === true) {
      if (options.enforceSchemaProperties) {
        delete workingValue[key];
      }

      return;
    }
    const child = this.visit(additionalPropertiesNode, graph, workingValue[key], `${path}/${escape(key)}`, options, refStack, dynamicScope, depth + 1);

    if (child.valid) {
      workingValue[key] = child.value;
      evaluatedProperties.add(key);
    } else {
      errors.push(...child.errors);
    }
  }

  private applyPropertyDefaults(
    propertyNodeMap: ReadonlyMap<string, SchemaGraphNodeInterface>,
    workingValue: Record<string, unknown>,
    graph: SchemaGraphInterface,
    dynamicScope: DynamicScopeEntryInterface[]
  ): void {
    for (const [
      key,
      propNode
    ] of propertyNodeMap) {
      if (key in workingValue) {
        continue;
      }
      const prepared = this.createImplicitDefault(propNode, graph, dynamicScope);

      if (prepared !== undefined) {
        workingValue[key] = prepared;
      }
    }
  }

  private applyRequiredDefaults(
    required: readonly string[],
    propertyNodeMap: ReadonlyMap<string, SchemaGraphNodeInterface>,
    workingValue: Record<string, unknown>,
    graph: SchemaGraphInterface,
    dynamicScope: DynamicScopeEntryInterface[],
    options: EffectiveOptionsType,
    errors: ValidationErrorType[],
    path: string
  ): void {
    for (const key of required) {
      if (!(key in workingValue)) {
        const propNode = propertyNodeMap.get(key);

        if (options.applyDefaults && propNode !== undefined) {
          const prepared = this.createImplicitDefault(propNode, graph, dynamicScope);

          if (prepared !== undefined) {
            workingValue[key] = prepared;
          }
        }
      }
      if (!(key in workingValue)) {
        if (options.synthesizeDefaults) {
          const propNode = propertyNodeMap.get(key);
          const zeroValue = propNode === undefined
            ? null
            : this.synthesizeZeroValue(propNode, graph, dynamicScope);

          workingValue[key] = zeroValue;
        } else {
          errors.push(this.createError(path, 'required', `must have required property '${key}'`, { 'missingProperty': key }));
        }
      }
    }
  }

  private applyUnevaluatedItems(
    node: SchemaGraphNodeInterface,
    graph: SchemaGraphInterface,
    value: unknown[],
    path: string,
    options: EffectiveOptionsType,
    refStack: Set<string>,
    dynamicScope: DynamicScopeEntryInterface[],
    alreadyEvaluated: Set<number>,
    depth: number
  ): InternalExecutionResultInterface {
    const errors: ValidationErrorType[] = [];
    const evaluatedItems = new Set<number>();
    const workingValue = value;
    const sem = graph.semantics(node);
    const unevaluatedItemsNode = sem.unevaluatedItemsNode;

    for (let index = 0; index < workingValue.length; index++) {
      if (alreadyEvaluated.has(index)) {
        continue;
      }

      if (unevaluatedItemsNode === undefined) {
        continue;
      }

      if (typeof unevaluatedItemsNode.schema === 'boolean') {
        if (!unevaluatedItemsNode.schema) {
          errors.push(this.createError(`${path}/${index}`, 'unevaluatedItems', 'must NOT have unevaluated items'));
        }
        continue;
      }
      const child = this.visit(unevaluatedItemsNode, graph, workingValue[index], `${path}/${index}`, options, refStack, dynamicScope, depth + 1);

      if (!child.valid && !options.collectErrors) {
        return child;
      }
      workingValue[index] = child.value;
      evaluatedItems.add(index);
      errors.push(...child.errors);
    }

    return {
      errors,
      evaluatedItems,
      'evaluatedProperties': undefined,
      'valid': errors.length === 0,
      'value': workingValue
    };
  }

  private applyUnevaluatedProperties(
    node: SchemaGraphNodeInterface,
    graph: SchemaGraphInterface,
    value: Record<string, unknown>,
    path: string,
    options: EffectiveOptionsType,
    refStack: Set<string>,
    dynamicScope: DynamicScopeEntryInterface[],
    alreadyEvaluated: Set<string>,
    depth: number
  ): InternalExecutionResultInterface {
    const errors: ValidationErrorType[] = [];
    const evaluatedProperties = new Set<string>();
    const workingValue = value;
    const sem = graph.semantics(node);
    const unevaluatedPropertiesNode = sem.unevaluatedPropertiesNode;

    for (const key of Object.keys(workingValue)) {
      if (alreadyEvaluated.has(key)) {
        continue;
      }

      if (unevaluatedPropertiesNode === undefined) {
        continue;
      }

      if (typeof unevaluatedPropertiesNode.schema === 'boolean') {
        if (!unevaluatedPropertiesNode.schema) {
          errors.push(this.createError(`${path}/${escape(key)}`, 'unevaluatedProperties', 'must NOT have unevaluated properties', { 'unevaluatedProperty': key }));
        }
        continue;
      }
      const child = this.visit(unevaluatedPropertiesNode, graph, workingValue[key], `${path}/${escape(key)}`, options, refStack, dynamicScope, depth + 1);

      if (!child.valid && !options.collectErrors) {
        return child;
      }
      workingValue[key] = child.value;
      evaluatedProperties.add(key);
      errors.push(...child.errors);
    }

    return {
      errors,
      'evaluatedItems': undefined,
      evaluatedProperties,
      'valid': errors.length === 0,
      'value': workingValue
    };
  }

  private buildPatternPropertyEntries(node: SchemaGraphNodeInterface, sem: SchemaGraphSemanticsInterface): Array<{ 'node': SchemaGraphNodeInterface;
    'pattern': string;
    'regex': RegExp }> {
    let patternPropertyEntries = this.patternEntryCache.get(node);

    if (patternPropertyEntries === undefined) {
      patternPropertyEntries = sem.patternPropertyEntries.map(([
        pattern,
        patternNode
      ]: readonly [string, SchemaGraphNodeInterface
      ]): { 'node': SchemaGraphNodeInterface;
        'pattern': string;
        'regex': RegExp } => {
        return {
          'node': patternNode,
          pattern,
          'regex': this.regexFor(pattern)
        };
      });
      this.patternEntryCache.set(node, patternPropertyEntries);
    }

    return patternPropertyEntries;
  }

  public check(value: unknown, options?: { 'pointer'?: string }): boolean {
    return this.execute(value, {
      'overrides': { 'collectErrors': false },
      'pointer': options?.pointer ?? ''
    }).valid;
  }

  private coerceValue(schemaTypes: string[], value: unknown, materializeContainers: boolean): unknown {
    return GraphEngineScalars.coerceGraphValue(schemaTypes, value, materializeContainers);
  }

  private createError(
    path: string,
    keyword: string,
    message: string,
    params: Record<string, unknown> = {}
  ): ValidationErrorType {
    return BaseError.validationError(path, keyword, message, params);
  }

  private createImplicitDefault(
    node: SchemaGraphNodeInterface,
    graph: SchemaGraphInterface,
    dynamicScope: DynamicScopeEntryInterface[]
  ): unknown {
    const ctx = this.cachedDefaultResolutionContext;

    return GraphEngineDefaults.createImplicitDefaultValue(ctx, node, graph, dynamicScope);
  }

  private defaultResolutionContext(): DefaultResolutionContextInterface {
    return {
      'resolveDynamicRef': (ref: string, currentGraph: SchemaGraphInterface, dynamicScope: DynamicScopeEntryInterface[]): RefTargetInterface => {
        return this.resolveDynamicRef(ref, currentGraph, dynamicScope);
      },
      'resolveRef': (ref: string, currentGraph: SchemaGraphInterface): RefTargetInterface => {
        return this.resolveRef(ref, currentGraph);
      }
    };
  }

  public errors(value: unknown, options?: { 'pointer'?: string }): ValidationErrorType[] {
    return this.execute(value, {
      'overrides': { 'collectErrors': true },
      'pointer': options?.pointer ?? ''
    }).errors;
  }

  public execute(
    value: unknown,
    options?: { 'overrides'?: Partial<Omit<GraphEngineOptionsInterface, 'formatRegistry' | 'lookupSchema'>>
      'pointer'?: string; }
  ): GraphExecutionResultInterface {
    const {
      overrides, pointer
    } = options ?? {};
    const graph = this.graphFor(this.rootSchema);
    const entryNode = graph.resolvePointer(pointer ?? '');
    const effective = overrides !== undefined && Object.keys(overrides).length > 0
      ? {
        ...this.options,
        ...overrides
      }
      : this.options;

    const result = this.visit(entryNode, graph, value, '', effective, this.reusableRefStack, this.reusableDynamicScope);

    return {
      entryNode,
      'errors': result.errors,
      'evaluatedItems': result.evaluatedItems ?? EMPTY_EVALUATED_ITEMS,
      'evaluatedProperties': result.evaluatedProperties ?? EMPTY_EVALUATED_PROPERTIES,
      graph,
      'valid': result.valid,
      'value': result.value
    };
  }

  private graphFor(rootSchema: JsonSchemaDocumentType): SchemaGraphInterface {
    if (!isRecord(rootSchema)) {
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

  public graphLookup(): ((schemaId: string) => SchemaGraphInterface | undefined) | undefined {
    return this.options.lookupGraph;
  }

  public hasRegisteredCustomKeywords(): boolean {
    return this.customKeywords.length > 0;
  }

  public keywords(): KeywordDefinitionInterface[] {
    return this.customKeywords;
  }

  private matchesType(schemaTypes: string[], value: unknown): boolean {
    return GraphEngineScalars.matchesSchemaTypes(schemaTypes, value);
  }

  private regexFor(pattern: string): RegExp {
    const cached = this.regexCache.get(pattern);

    if (cached !== undefined) {
      return cached;
    }

    const compiled = new RegExp(pattern, 'u');

    this.regexCache.set(pattern, compiled);

    return compiled;
  }

  private resolveAliases(
    propertyNodeMap: ReadonlyMap<string, SchemaGraphNodeInterface>,
    workingValue: Record<string, unknown>,
    graph: SchemaGraphInterface
  ): void {
    for (const [
      canonicalKey,
      propNode
    ] of propertyNodeMap) {
      const propSem = graph.semantics(propNode);

      for (const alias of propSem.aliases) {
        if (alias in workingValue) {
          if (!(canonicalKey in workingValue)) {
            workingValue[canonicalKey] = workingValue[alias];
          }
          delete workingValue[alias];
          break;
        }
      }
    }
  }

  private resolveDynamicRef(
    ref: string,
    currentGraph: SchemaGraphInterface,
    dynamicScope: DynamicScopeEntryInterface[]
  ): RefTargetInterface {
    if (ref === '#') {
      for (let index = dynamicScope.length - 1; index >= 0; index--) {
        if (dynamicScope[index].anchor === '') {
          return {
            'graph': dynamicScope[index].graph,
            'node': dynamicScope[index].node
          };
        }
      }
    }

    const resolved = this.resolveRef(ref, currentGraph);
    const fragment = GraphEngineSupport.extractNamedFragment(ref);
    const resolvedSem = resolved.graph.semantics(resolved.node);
    const resolvedAnchor = resolvedSem.dynamicAnchor;

    if (fragment === undefined || resolvedAnchor !== fragment) {
      return resolved;
    }

    for (const entry of dynamicScope) {
      if (entry.anchor === fragment) {
        return {
          'graph': entry.graph,
          'node': entry.node
        };
      }
    }

    return resolved;
  }

  private resolveRef(ref: string, currentGraph: SchemaGraphInterface): RefTargetInterface {
    const isOwnRoot = currentGraph.rootSchema === this.rootSchema;
    const cached = this.resolveRefFromCache(ref, isOwnRoot, currentGraph);

    if (cached !== undefined) {
      return cached;
    }

    let graph = currentGraph;
    let fragment: string;

    if (ref.startsWith('#')) {
      fragment = ref.slice(1);
    } else {
      const parsed = GraphEngineSupport.parseRef(ref);

      fragment = parsed.fragment;
      graph = this.resolveRefGraph(ref, parsed);
    }

    const node = graph.resolveFragment(fragment);
    const target = {
      graph,
      node
    };

    this.storeRefInCache(ref, isOwnRoot, currentGraph, target);

    return target;
  }

  private resolveRefFromCache(
    ref: string,
    isOwnRoot: boolean,
    currentGraph: SchemaGraphInterface
  ): RefTargetInterface | undefined {
    if (isOwnRoot) {
      return this.refCacheOwn.get(ref);
    }
    const currentRootId = GraphEngineSupport.schemaId(currentGraph.rootSchema);
    const cacheKey = `${currentRootId ?? '<anonymous>'}::${ref}`;

    return this.refCache.get(cacheKey);
  }

  private resolveRefGraph(ref: string, parsed: { 'fragment': string;
    'id': string }): SchemaGraphInterface {
    const lookedUp = this.options.lookupSchema?.(parsed.id);

    if (lookedUp !== undefined) {
      return this.graphFor(lookedUp);
    }
    if (this.rootId !== undefined && parsed.id === this.rootId) {
      return this.graphFor(this.rootSchema);
    }
    const embedded = this.embeddedSchemas.get(parsed.id);

    if (embedded === undefined) {
      throw new GraphError('REF_UNRESOLVED', `Unresolved schema reference: ${ref}`, { 'pointer': ref });
    }

    return this.graphFor(embedded);
  }

  public rootSchemaId(): string | undefined {
    return GraphEngineSupport.schemaId(this.rootSchema);
  }

  public schemaLookup(): ((schemaId: string) => Record<string, unknown> | undefined) | undefined {
    return this.options.lookupSchema;
  }

  private storeRefInCache(
    ref: string,
    isOwnRoot: boolean,
    currentGraph: SchemaGraphInterface,
    target: RefTargetInterface
  ): void {
    if (isOwnRoot) {
      this.refCacheOwn.set(ref, target);

      return;
    }
    const currentRootId = GraphEngineSupport.schemaId(currentGraph.rootSchema);
    const cacheKey = `${currentRootId ?? '<anonymous>'}::${ref}`;

    this.refCache.set(cacheKey, target);
  }

  private synthesizeZeroValue(
    node: SchemaGraphNodeInterface,
    graph: SchemaGraphInterface,
    dynamicScope: DynamicScopeEntryInterface[]
  ): unknown {
    return GraphEngineDefaults.synthesizeZeroValue(this.cachedDefaultResolutionContext, node, graph, dynamicScope);
  }

  private validateArray(
    graph: SchemaGraphInterface,
    value: unknown[],
    path: string,
    options: EffectiveOptionsType,
    refStack: Set<string>,
    dynamicScope: DynamicScopeEntryInterface[],
    sem: SchemaGraphSemanticsInterface,
    depth: number
  ): InternalExecutionResultInterface {
    const errors: ValidationErrorType[] = [];
    const evaluatedItems = new Set<number>();
    const workingValue = value;
    const {
      itemsNode,
      maxItems,
      minItems,
      prefixItems,
      uniqueItems
    } = sem;

    this.validateArrayCardinality(path, workingValue, minItems, maxItems, errors);
    this.validateArrayUniqueness(path, workingValue, uniqueItems, errors);

    const prefixEarlyReturn = this.validateArrayPrefixItems(
      graph,
      path,
      options,
      refStack,
      dynamicScope,
      sem,
      workingValue,
      evaluatedItems,
      errors,
      depth
    );

    if (prefixEarlyReturn !== undefined) {
      return prefixEarlyReturn;
    }

    if (prefixItems.length === 0) {
      const itemsEarlyReturn = this.validateArrayItems(
        graph,
        path,
        options,
        refStack,
        dynamicScope,
        itemsNode,
        workingValue,
        evaluatedItems,
        errors,
        depth
      );

      if (itemsEarlyReturn !== undefined) {
        return itemsEarlyReturn;
      }
    }

    this.validateArrayContains(
      graph,
      path,
      options,
      refStack,
      dynamicScope,
      sem,
      workingValue,
      evaluatedItems,
      errors,
      depth
    );

    return {
      errors,
      evaluatedItems,
      'evaluatedProperties': undefined,
      'valid': errors.length === 0,
      'value': workingValue
    };
  }

  private validateArrayCardinality(
    path: string,
    workingValue: unknown[],
    minItems: number | undefined,
    maxItems: number | undefined,
    errors: ValidationErrorType[]
  ): void {
    if (typeof minItems === 'number' && workingValue.length < minItems) {
      errors.push(this.createError(path, 'minItems', `must have at least ${minItems} items`, { 'limit': minItems }));
    }
    if (typeof maxItems === 'number' && workingValue.length > maxItems) {
      errors.push(this.createError(path, 'maxItems', `must have at most ${maxItems} items`, { 'limit': maxItems }));
    }
  }

  private validateArrayContains(
    graph: SchemaGraphInterface,
    path: string,
    options: EffectiveOptionsType,
    refStack: Set<string>,
    dynamicScope: DynamicScopeEntryInterface[],
    sem: SchemaGraphSemanticsInterface,
    workingValue: unknown[],
    evaluatedItems: Set<number>,
    errors: ValidationErrorType[],
    depth: number
  ): void {
    const {
      containsNode, maxContains, minContains
    } = sem;

    if (containsNode === undefined) {
      return;
    }
    let matches = 0;

    for (const [
      index,
      element
    ] of workingValue.entries()) {
      const candidate = this.visit(containsNode, graph, GraphEngineSupport.cloneCandidate(element), `${path}/${index}`, {
        ...options,
        'collectErrors': true
      }, refStack, dynamicScope, depth + 1);

      if (candidate.valid) {
        matches++;
        evaluatedItems.add(index);
      }
    }

    const minimumContains = typeof minContains === 'number' ? minContains : 1;
    const maximumContains = typeof maxContains === 'number' ? maxContains : undefined;

    if (matches < minimumContains) {
      errors.push(this.createError(path, 'contains', 'must contain required matching items', { 'minContains': minimumContains }));
    }
    if (maximumContains !== undefined && matches > maximumContains) {
      errors.push(this.createError(path, 'maxContains', 'must not contain too many matching items', { 'maxContains': maximumContains }));
    }
  }

  private validateArrayItems(
    graph: SchemaGraphInterface,
    path: string,
    options: EffectiveOptionsType,
    refStack: Set<string>,
    dynamicScope: DynamicScopeEntryInterface[],
    itemsNode: SchemaGraphNodeInterface | undefined,
    workingValue: unknown[],
    evaluatedItems: Set<number>,
    errors: ValidationErrorType[],
    depth: number
  ): InternalExecutionResultInterface | undefined {
    if (itemsNode === undefined) {
      return undefined;
    }
    for (let index = 0; index < workingValue.length; index++) {
      const child = this.visit(itemsNode, graph, workingValue[index], `${path}/${index}`, options, refStack, dynamicScope, depth + 1);

      if (!child.valid && !options.collectErrors) {
        return child;
      }
      workingValue[index] = child.value;
      evaluatedItems.add(index);
      errors.push(...child.errors);
    }

    return undefined;
  }

  private validateArrayPrefixItems(
    graph: SchemaGraphInterface,
    path: string,
    options: EffectiveOptionsType,
    refStack: Set<string>,
    dynamicScope: DynamicScopeEntryInterface[],
    sem: SchemaGraphSemanticsInterface,
    workingValue: unknown[],
    evaluatedItems: Set<number>,
    errors: ValidationErrorType[],
    depth: number
  ): InternalExecutionResultInterface | undefined {
    const {
      itemsNode, 'prefixItems': prefixItemNodes
    } = sem;

    if (prefixItemNodes.length === 0) {
      return undefined;
    }

    for (const [
      index,
      itemNode
    ] of prefixItemNodes.entries()) {
      if (index >= workingValue.length) {
        break;
      }
      const child = this.visit(itemNode, graph, workingValue[index], `${path}/${index}`, options, refStack, dynamicScope, depth + 1);

      if (!child.valid && !options.collectErrors) {
        return child;
      }
      workingValue[index] = child.value;
      evaluatedItems.add(index);
      errors.push(...child.errors);
    }

    return this.validateExtraItemsAfterPrefix(
      graph,
      path,
      options,
      refStack,
      dynamicScope,
      itemsNode,
      prefixItemNodes.length,
      workingValue,
      evaluatedItems,
      errors,
      depth
    );
  }

  private validateArrayUniqueness(
    path: string,
    workingValue: unknown[],
    uniqueItems: boolean | undefined,
    errors: ValidationErrorType[]
  ): void {
    if (uniqueItems !== true) {
      return;
    }
    outer: for (let index = 0; index < workingValue.length; index++) {
      const item = workingValue[index];

      for (let j = index + 1; j < workingValue.length; j++) {
        if (deepEqual(item, workingValue[j])) {
          errors.push(this.createError(path, 'uniqueItems', 'must NOT have duplicate items'));

          break outer;
        }
      }
    }
  }

  private validateDependentRequired(
    dependentRequired: Record<string, string[]>,
    workingValue: Record<string, unknown>,
    path: string,
    errors: ValidationErrorType[]
  ): void {
    if (Object.keys(dependentRequired).length === 0) {
      return;
    }
    for (const [
      key,
      dependencies
    ] of Object.entries(dependentRequired)) {
      if (!(key in workingValue)) {
        continue;
      }
      for (const dependency of dependencies) {
        if (!(dependency in workingValue)) {
          errors.push(this.createError(path, 'dependentRequired', `must have property '${dependency}' when '${key}' is present`, {
            dependency,
            key
          }));
        }
      }
    }
  }

  private validateDependentSchemas(
    dependentSchemaEntries: ReadonlyArray<readonly [string, SchemaGraphNodeInterface]>,
    workingValue: Record<string, unknown>,
    graph: SchemaGraphInterface,
    path: string,
    options: EffectiveOptionsType,
    refStack: Set<string>,
    dynamicScope: DynamicScopeEntryInterface[],
    evaluatedProperties: Set<string>,
    errors: ValidationErrorType[],
    depth: number
  ): InternalExecutionResultInterface | undefined {
    if (dependentSchemaEntries.length === 0) {
      return undefined;
    }
    for (const [
      key,
      dependencyNode
    ] of dependentSchemaEntries) {
      if (!(key in workingValue)) {
        continue;
      }
      const child = this.visit(dependencyNode, graph, workingValue, path, options, refStack, dynamicScope, depth + 1);

      if (!child.valid && !options.collectErrors) {
        return child;
      }
      errors.push(...child.errors);
      if (child.evaluatedProperties !== undefined) {
        for (const evaluated of child.evaluatedProperties) {
          evaluatedProperties.add(evaluated);
        }
      }
    }

    return undefined;
  }

  private validateExtraItemsAfterPrefix(
    graph: SchemaGraphInterface,
    path: string,
    options: EffectiveOptionsType,
    refStack: Set<string>,
    dynamicScope: DynamicScopeEntryInterface[],
    itemsNode: SchemaGraphNodeInterface | undefined,
    extraStart: number,
    workingValue: unknown[],
    evaluatedItems: Set<number>,
    errors: ValidationErrorType[],
    depth: number
  ): InternalExecutionResultInterface | undefined {
    if (itemsNode?.schema === false && workingValue.length > extraStart) {
      errors.push(this.createError(path, 'items', 'must NOT have items beyond prefixItems'));

      return undefined;
    }
    if (itemsNode === undefined || itemsNode.schema === true || itemsNode.schema === false) {
      return undefined;
    }
    for (let index = extraStart; index < workingValue.length; index++) {
      const child = this.visit(itemsNode, graph, workingValue[index], `${path}/${index}`, options, refStack, dynamicScope, depth + 1);

      if (!child.valid && !options.collectErrors) {
        return child;
      }
      workingValue[index] = child.value;
      evaluatedItems.add(index);
      errors.push(...child.errors);
    }

    return undefined;
  }

  private validateNumber(
    path: string,
    value: number,
    sem: SchemaGraphSemanticsInterface
  ): ValidationErrorType[] {
    const { formatAssertions } = this.dialectPlan;

    return GraphEngineScalars.validateNumberConstraints(path, value, sem, this.formatRegistry, formatAssertions);
  }

  private validateObject(
    node: SchemaGraphNodeInterface,
    graph: SchemaGraphInterface,
    value: Record<string, unknown>,
    path: string,
    options: EffectiveOptionsType,
    refStack: Set<string>,
    dynamicScope: DynamicScopeEntryInterface[],
    depth: number
  ): InternalExecutionResultInterface {
    const errors: ValidationErrorType[] = [];
    const evaluatedProperties = new Set<string>();
    const sem = graph.semantics(node);
    const patternPropertyEntries = this.buildPatternPropertyEntries(node, sem);
    const workingValue = value;

    this.resolveAliases(sem.properties, workingValue, graph);
    this.validateObjectCardinality(path, Object.keys(workingValue), sem.minProperties, sem.maxProperties, errors);

    if (options.applyDefaults) {
      this.applyPropertyDefaults(sem.properties, workingValue, graph, dynamicScope);
    }
    this.applyRequiredDefaults(sem.required, sem.properties, workingValue, graph, dynamicScope, options, errors, path);

    const iterKeys = Object.keys(workingValue);
    const constraintEarlyReturn = this.validateObjectConstraints(
      sem,
      graph,
      workingValue,
      path,
      options,
      refStack,
      dynamicScope,
      evaluatedProperties,
      errors,
      iterKeys,
      patternPropertyEntries,
      depth
    );

    if (constraintEarlyReturn !== undefined) {
      return constraintEarlyReturn;
    }

    for (const key of iterKeys) {
      if (!evaluatedProperties.has(key)) {
        this.applyAdditionalProperty(
          key,
          sem.additionalPropertiesNode,
          graph,
          workingValue,
          path,
          options,
          refStack,
          dynamicScope,
          evaluatedProperties,
          errors,
          depth
        );
      }
    }

    return {
      errors,
      'evaluatedItems': undefined,
      evaluatedProperties,
      'valid': errors.length === 0,
      'value': workingValue
    };
  }

  private validateObjectCardinality(
    path: string,
    objectKeys: string[],
    minProperties: number | undefined,
    maxProperties: number | undefined,
    errors: ValidationErrorType[]
  ): void {
    if (typeof minProperties === 'number' && objectKeys.length < minProperties) {
      errors.push(this.createError(path, 'minProperties', `must NOT have fewer than ${minProperties} properties`, { 'limit': minProperties }));
    }
    if (typeof maxProperties === 'number' && objectKeys.length > maxProperties) {
      errors.push(this.createError(path, 'maxProperties', `must NOT have more than ${maxProperties} properties`, { 'limit': maxProperties }));
    }
  }

  private validateObjectConstraints(
    sem: SchemaGraphSemanticsInterface,
    graph: SchemaGraphInterface,
    workingValue: Record<string, unknown>,
    path: string,
    options: EffectiveOptionsType,
    refStack: Set<string>,
    dynamicScope: DynamicScopeEntryInterface[],
    evaluatedProperties: Set<string>,
    errors: ValidationErrorType[],
    iterKeys: string[],
    patternPropertyEntries: Array<{ 'node': SchemaGraphNodeInterface;
      'pattern': string;
      'regex': RegExp }>,
    depth: number
  ): InternalExecutionResultInterface | undefined {
    const {
      dependentRequired,
      dependentSchemaEntries,
      properties,
      propertyNamesNode
    } = sem;
    const propEarlyReturn = this.validateObjectProperties(
      iterKeys,
      properties,
      patternPropertyEntries,
      propertyNamesNode,
      graph,
      workingValue,
      path,
      options,
      refStack,
      dynamicScope,
      evaluatedProperties,
      errors,
      depth
    );

    if (propEarlyReturn !== undefined) {
      return propEarlyReturn;
    }
    this.validateDependentRequired(dependentRequired, workingValue, path, errors);

    return this.validateDependentSchemas(
      dependentSchemaEntries,
      workingValue,
      graph,
      path,
      options,
      refStack,
      dynamicScope,
      evaluatedProperties,
      errors,
      depth
    );
  }

  private validateObjectProperties(
    iterKeys: string[],
    propertyNodeMap: ReadonlyMap<string, SchemaGraphNodeInterface>,
    patternPropertyEntries: Array<{ 'node': SchemaGraphNodeInterface;
      'pattern': string;
      'regex': RegExp }>,
    propertyNamesNode: SchemaGraphNodeInterface | undefined,
    graph: SchemaGraphInterface,
    workingValue: Record<string, unknown>,
    path: string,
    options: EffectiveOptionsType,
    refStack: Set<string>,
    dynamicScope: DynamicScopeEntryInterface[],
    evaluatedProperties: Set<string>,
    errors: ValidationErrorType[],
    depth: number
  ): InternalExecutionResultInterface | undefined {
    for (const key of iterKeys) {
      const nameCheckResult = this.validatePropertyKey(
        key,
        propertyNamesNode,
        graph,
        path,
        options,
        refStack,
        dynamicScope,
        errors,
        depth
      );

      if (nameCheckResult !== undefined) {
        return nameCheckResult;
      }

      const propNode = propertyNodeMap.get(key);

      if (propNode !== undefined) {
        const child = this.visit(propNode, graph, workingValue[key], `${path}/${escape(key)}`, options, refStack, dynamicScope, depth + 1);

        if (!child.valid && !options.collectErrors) {
          return child;
        }
        workingValue[key] = child.value;
        evaluatedProperties.add(key);
        errors.push(...child.errors);
      }

      const patternResult = this.validatePatternProperties(
        key,
        patternPropertyEntries,
        graph,
        workingValue,
        path,
        options,
        refStack,
        dynamicScope,
        evaluatedProperties,
        errors,
        depth
      );

      if (patternResult !== undefined) {
        return patternResult;
      }
    }

    return undefined;
  }

  private validatePatternProperties(
    key: string,
    patternPropertyEntries: Array<{ 'node': SchemaGraphNodeInterface;
      'pattern': string;
      'regex': RegExp }>,
    graph: SchemaGraphInterface,
    workingValue: Record<string, unknown>,
    path: string,
    options: EffectiveOptionsType,
    refStack: Set<string>,
    dynamicScope: DynamicScopeEntryInterface[],
    evaluatedProperties: Set<string>,
    errors: ValidationErrorType[],
    depth: number
  ): InternalExecutionResultInterface | undefined {
    for (const patternEntry of patternPropertyEntries) {
      if (!patternEntry.regex.test(key)) {
        continue;
      }
      const child = this.visit(patternEntry.node, graph, workingValue[key], `${path}/${escape(key)}`, options, refStack, dynamicScope, depth + 1);

      if (!child.valid && !options.collectErrors) {
        return child;
      }
      workingValue[key] = child.value;
      evaluatedProperties.add(key);
      errors.push(...child.errors);
    }

    return undefined;
  }

  private validatePropertyKey(
    key: string,
    propertyNamesNode: SchemaGraphNodeInterface | undefined,
    graph: SchemaGraphInterface,
    path: string,
    options: EffectiveOptionsType,
    refStack: Set<string>,
    dynamicScope: DynamicScopeEntryInterface[],
    errors: ValidationErrorType[],
    depth: number
  ): InternalExecutionResultInterface | undefined {
    if (propertyNamesNode === undefined) {
      return undefined;
    }
    const propertyNameResult = this.visit(propertyNamesNode, graph, key, path, {
      ...options,
      'applyDefaults': false,
      'removeAdditionalProperties': false
    }, refStack, dynamicScope, depth + 1);

    if (!propertyNameResult.valid && !options.collectErrors) {
      return propertyNameResult;
    }
    errors.push(...propertyNameResult.errors.map((error: ValidationErrorType): ValidationErrorType => {
      return {
        ...error,
        'path': `${path}/${escape(key)}`
      };
    }));

    return undefined;
  }

  private validateString(
    path: string,
    value: string,
    sem: SchemaGraphSemanticsInterface
  ): ValidationErrorType[] {
    return GraphEngineScalars.validateStringConstraints(
      path,
      value,
      sem,
      (pattern: string): RegExp => {
        return this.regexFor(pattern);
      },
      this.formatRegistry,
      this.dialectPlan.formatAssertions
    );
  }

  private visit(
    node: SchemaGraphNodeInterface,
    graph: SchemaGraphInterface,
    value: unknown,
    path: string,
    options: EffectiveOptionsType,
    refStack: Set<string>,
    dynamicScope: DynamicScopeEntryInterface[],
    depth = 0
  ): InternalExecutionResultInterface {
    const ctx = this.cachedVisitContext;

    return GraphEngineVisit.visit(ctx, node, graph, value, path, options, refStack, dynamicScope, depth);
  }

  private visitContext(): VisitContextInterface {
    return {
      ...this.visitContextResolution(),
      ...this.visitContextUnevaluated(),
      ...this.visitContextValidators()
    };
  }

  private visitContextResolution(): Pick<VisitContextInterface, 'coerceValue' | 'createError' | 'customKeywords' | 'graphFor' | 'matchesType' | 'resolveDynamicRef' | 'resolveRef' | 'synthesizeZeroValue'> {
    return {
      'coerceValue': (schemaTypes: string[], value: unknown, materializeContainers: boolean): unknown => {
        return this.coerceValue(schemaTypes, value, materializeContainers);
      },
      'createError': (path: string, keyword: string, message: string, params?: Record<string, unknown>): ValidationErrorType => {
        return this.createError(path, keyword, message, params);
      },
      'customKeywords': this.customKeywords,
      'graphFor': (rootSchema: boolean | Record<string, unknown>): SchemaGraphInterface => {
        return this.graphFor(rootSchema);
      },
      'matchesType': (schemaTypes: string[], value: unknown): boolean => {
        return this.matchesType(schemaTypes, value);
      },
      'resolveDynamicRef': (ref: string, currentGraph: SchemaGraphInterface, dynamicScope: DynamicScopeEntryInterface[]): RefTargetInterface => {
        return this.resolveDynamicRef(ref, currentGraph, dynamicScope);
      },
      'resolveRef': (ref: string, currentGraph: SchemaGraphInterface): RefTargetInterface => {
        return this.resolveRef(ref, currentGraph);
      },
      'synthesizeZeroValue': (node: SchemaGraphNodeInterface, graph: SchemaGraphInterface, dynamicScope: DynamicScopeEntryInterface[]): unknown => {
        return this.synthesizeZeroValue(node, graph, dynamicScope);
      }
    };
  }

  private visitContextUnevaluated(): Pick<VisitContextInterface, 'applyUnevaluatedItems' | 'applyUnevaluatedProperties'> {
    return {
      'applyUnevaluatedItems': (
        node: SchemaGraphNodeInterface,
        graph: SchemaGraphInterface,
        value: unknown[],
        path: string,
        options: EffectiveOptionsType,
        refStack: Set<string>,
        dynamicScope: DynamicScopeEntryInterface[],
        alreadyEvaluated: Set<number>,
        depth: number
      ): InternalExecutionResultInterface => {
        return this.applyUnevaluatedItems(
          node,
          graph,
          value,
          path,
          options,
          refStack,
          dynamicScope,
          alreadyEvaluated,
          depth
        );
      },
      'applyUnevaluatedProperties': (
        node: SchemaGraphNodeInterface,
        graph: SchemaGraphInterface,
        value: Record<string, unknown>,
        path: string,
        opts: EffectiveOptionsType,
        refStack: Set<string>,
        dynScope: DynamicScopeEntryInterface[],
        evaluated: Set<string>,
        depth: number
      ): InternalExecutionResultInterface => {
        return this.applyUnevaluatedProperties(node, graph, value, path, opts, refStack, dynScope, evaluated, depth);
      }
    };
  }

  private visitContextValidators(): Pick<VisitContextInterface, 'validateArray' | 'validateNumber' | 'validateObject' | 'validateString'> {
    return {
      'validateArray': (
        graph: SchemaGraphInterface,
        value: unknown[],
        path: string,
        options: EffectiveOptionsType,
        refStack: Set<string>,
        dynamicScope: DynamicScopeEntryInterface[],
        sem: SchemaGraphSemanticsInterface,
        depth: number
      ): InternalExecutionResultInterface => {
        return this.validateArray(graph, value, path, options, refStack, dynamicScope, sem, depth);
      },
      'validateNumber': (path: string, value: number, sem: SchemaGraphSemanticsInterface): ValidationErrorType[] => {
        return this.validateNumber(path, value, sem);
      },
      'validateObject': (
        node: SchemaGraphNodeInterface,
        graph: SchemaGraphInterface,
        value: Record<string, unknown>,
        path: string,
        options: EffectiveOptionsType,
        refStack: Set<string>,
        dynamicScope: DynamicScopeEntryInterface[],
        depth: number
      ): InternalExecutionResultInterface => {
        return this.validateObject(node, graph, value, path, options, refStack, dynamicScope, depth);
      },
      'validateString': (path: string, value: string, sem: SchemaGraphSemanticsInterface): ValidationErrorType[] => {
        return this.validateString(path, value, sem);
      }
    };
  }
}
