import type { ValidationErrorType } from '../../types/Validation.js';
import type {
  GraphEngineOptionsType, GraphExecutionResultType,
  KeywordDefinitionType
} from '../../types/GraphEngine.js';
import type { GraphEngineInterface } from '../../interfaces/GraphEngineImpl.js';
import type {
  SchemaGraphNodeType, SchemaGraphSemanticsType
} from '../../types/SchemaGraph.js';
import type { FormatRegistryInterface } from '../../interfaces/FormatRegistry.js';
import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphImpl.js';
import type { EffectiveOptionsType } from '../../types/EffectiveOptions.js';

import {
  deepEqual, isRecord
} from '../data/DataTypes.js';
import { FormatRegistry } from '../format/FormatRegistry.js';
import { SchemaGraph } from './SchemaGraph.js';
import { DEFAULT_OPTIONS } from '../../constants/DIALECT.js';
import {
  EMPTY_EVALUATED_ITEMS, EMPTY_EVALUATED_PROPERTIES
} from '../../constants/EXECUTION_OPTIONS.js';
import { GraphEngineSupport } from './GraphEngineSupport.js';
import { resolveRef as canonicalResolveRef } from './RefResolution.js';
import { SchemaGraphSupport } from './SchemaGraphSupport.js';
import type { DynamicScopeEntryType } from '../../types/DynamicScopeEntry.js';
import type { InternalExecutionResultType } from '../../types/InternalExecutionResult.js';
import type { RefTargetType } from '../../types/RefTarget.js';
import type { RootDialectPlanType } from '../../types/RootDialectPlan.js';
import { GraphEngineScalars } from './GraphEngineScalars.js';
import { BaseError } from '../../errors/BaseError.js';
import { GraphEngineDefaults } from './GraphEngineDefaults.js';
import { VALIDATION_MESSAGES } from '../../constants/VALIDATION_MESSAGES.js';
import type { DefaultResolutionContextType } from '../../types/DefaultResolutionContext.js';
import { GraphEngineVisit } from './GraphEngineVisit.js';
import type { VisitContextType } from '../../types/VisitContext.js';
import type { JsonSchemaDocumentType } from '../../types/Schema.js';

// EMPTY_EVALUATED_ITEMS and EMPTY_EVALUATED_PROPERTIES imported from EXECUTION_OPTIONS

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
 * Customise behaviour via `GraphEngineOptionsType`: plug in a custom
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
  private readonly cachedDefaultResolutionContext: DefaultResolutionContextType;
  private readonly cachedVisitContext: VisitContextType;
  private readonly customKeywords: KeywordDefinitionType[];
  private readonly dialectPlan: RootDialectPlanType;
  public readonly formatRegistry: FormatRegistryInterface;
  private readonly graphCache = new WeakMap<object, SchemaGraph>();
  private readonly options: EffectiveOptionsType;
  private readonly patternEntryCache = new WeakMap<SchemaGraphNodeType, Array<{ 'node': SchemaGraphNodeType;
    'pattern': string;
    'regex': RegExp }>>();
  private readonly refCache = new Map<string, RefTargetType>();
  private readonly refCacheOwn = new Map<string, RefTargetType>();
  private readonly regexCache = new Map<string, RegExp>();
  /** Reusable per-engine dynamicScope — guaranteed empty at execute() entry; always reset before use. */
  private readonly reusableDynamicScope: DynamicScopeEntryType[] = [];
  /** Reusable per-engine refStack — guaranteed empty at execute() entry; add/delete are balanced. */
  private readonly reusableRefStack = new Set<string>();
  private readonly rootId: string | undefined;

  public constructor(public readonly rootSchema: JsonSchemaDocumentType, options: GraphEngineOptionsType = {}) {
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
    this.rootId = GraphEngineSupport.schemaId(rootSchema);
    this.cachedDefaultResolutionContext = this.defaultResolutionContext();
    this.cachedVisitContext = this.visitContext();
  }

  private applyAdditionalProperty(
    key: string,
    additionalPropertiesNode: boolean | SchemaGraphNodeType | undefined,
    graph: SchemaGraphInterface,
    workingValue: Record<string, unknown>,
    path: string,
    options: EffectiveOptionsType,
    refStack: Set<string>,
    dynamicScope: DynamicScopeEntryType[],
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
        errors.push(this.createError(`${path}/${SchemaGraphSupport.escapeJsonPointerSegment(key)}`, 'additionalProperties', VALIDATION_MESSAGES.additionalProperties(key), { 'additionalProperty': key }));
      }

      return;
    }
    if (additionalPropertiesNode === undefined || additionalPropertiesNode === true) {
      if (options.enforceSchemaProperties) {
        delete workingValue[key];
      }

      return;
    }
    const child = this.visit(additionalPropertiesNode, graph, workingValue[key], `${path}/${SchemaGraphSupport.escapeJsonPointerSegment(key)}`, options, refStack, dynamicScope, depth + 1);

    if (child.valid) {
      workingValue[key] = child.value;
      evaluatedProperties.add(key);
    } else {
      errors.push(...child.errors);
    }
  }

  private applyPropertyDefaults(
    propertyNodeMap: ReadonlyMap<string, SchemaGraphNodeType>,
    workingValue: Record<string, unknown>,
    graph: SchemaGraphInterface,
    dynamicScope: DynamicScopeEntryType[]
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
    propertyNodeMap: ReadonlyMap<string, SchemaGraphNodeType>,
    workingValue: Record<string, unknown>,
    graph: SchemaGraphInterface,
    dynamicScope: DynamicScopeEntryType[],
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
          errors.push(this.createError(path, 'required', VALIDATION_MESSAGES.required(key), { 'missingProperty': key }));
        }
      }
    }
  }

  private applyUnevaluatedItems(
    node: SchemaGraphNodeType,
    graph: SchemaGraphInterface,
    value: unknown[],
    path: string,
    options: EffectiveOptionsType,
    refStack: Set<string>,
    dynamicScope: DynamicScopeEntryType[],
    alreadyEvaluated: Set<number>,
    depth: number
  ): InternalExecutionResultType {
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
          errors.push(this.createError(`${path}/${index}`, 'unevaluatedItems', VALIDATION_MESSAGES.unevaluatedItems));
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
    node: SchemaGraphNodeType,
    graph: SchemaGraphInterface,
    value: Record<string, unknown>,
    path: string,
    options: EffectiveOptionsType,
    refStack: Set<string>,
    dynamicScope: DynamicScopeEntryType[],
    alreadyEvaluated: Set<string>,
    depth: number
  ): InternalExecutionResultType {
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
          errors.push(this.createError(`${path}/${SchemaGraphSupport.escapeJsonPointerSegment(key)}`, 'unevaluatedProperties', VALIDATION_MESSAGES.unevaluatedProperties, { 'unevaluatedProperty': key }));
        }
        continue;
      }
      const child = this.visit(unevaluatedPropertiesNode, graph, workingValue[key], `${path}/${SchemaGraphSupport.escapeJsonPointerSegment(key)}`, options, refStack, dynamicScope, depth + 1);

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

  private buildPatternPropertyEntries(node: SchemaGraphNodeType, sem: SchemaGraphSemanticsType): Array<{ 'node': SchemaGraphNodeType;
    'pattern': string;
    'regex': RegExp }> {
    let patternPropertyEntries = this.patternEntryCache.get(node);

    if (patternPropertyEntries === undefined) {
      patternPropertyEntries = sem.patternPropertyEntries.map(([
        pattern,
        patternNode
      ]: readonly [string, SchemaGraphNodeType
      ]): { 'node': SchemaGraphNodeType;
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

  private createError(
    path: string,
    keyword: string,
    message: string,
    params: Record<string, unknown> = {}
  ): ValidationErrorType {
    return BaseError.validationError(path, keyword, message, params);
  }

  private createImplicitDefault(
    node: SchemaGraphNodeType,
    graph: SchemaGraphInterface,
    dynamicScope: DynamicScopeEntryType[]
  ): unknown {
    const ctx = this.cachedDefaultResolutionContext;

    return GraphEngineDefaults.createImplicitDefaultValue(ctx, node, graph, dynamicScope);
  }

  private defaultResolutionContext(): DefaultResolutionContextType {
    return {
      'resolveDynamicRef': (ref: string, currentGraph: SchemaGraphInterface, dynamicScope: DynamicScopeEntryType[]): RefTargetType => {
        return this.resolveDynamicRef(ref, currentGraph, dynamicScope);
      },
      'resolveRef': (ref: string, currentGraph: SchemaGraphInterface): RefTargetType => {
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
    options?: { 'overrides'?: Partial<Omit<GraphEngineOptionsType, 'formatRegistry' | 'lookupSchema'>>
      'pointer'?: string; }
  ): GraphExecutionResultType {
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
      return new SchemaGraph(rootSchema);
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

  public keywords(): KeywordDefinitionType[] {
    return this.customKeywords;
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
    propertyNodeMap: ReadonlyMap<string, SchemaGraphNodeType>,
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
    dynamicScope: DynamicScopeEntryType[]
  ): RefTargetType {
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

  private resolveRef(ref: string, currentGraph: SchemaGraphInterface): RefTargetType {
    const isOwnRoot = currentGraph.rootSchema === this.rootSchema;
    const cached = this.resolveRefFromCache(ref, isOwnRoot, currentGraph);

    if (cached !== undefined) {
      return cached;
    }

    const graphFor = (schema: Record<string, unknown>): SchemaGraphInterface => {
      return this.graphFor(schema);
    };
    const rootSchema = isRecord(this.rootSchema) ? this.rootSchema : undefined;
    const target = canonicalResolveRef(ref, currentGraph, {
      'graphFor': graphFor,
      ...(this.options.lookupGraph !== undefined && { 'lookupGraph': this.options.lookupGraph }),
      ...(this.options.lookupSchema !== undefined && { 'lookupSchema': this.options.lookupSchema }),
      ...(this.rootId !== undefined && { 'rootId': this.rootId }),
      ...(rootSchema !== undefined && { 'rootSchema': rootSchema })
    });

    this.storeRefInCache(ref, isOwnRoot, currentGraph, target);

    return target;
  }

  private resolveRefFromCache(
    ref: string,
    isOwnRoot: boolean,
    currentGraph: SchemaGraphInterface
  ): RefTargetType | undefined {
    if (isOwnRoot) {
      return this.refCacheOwn.get(ref);
    }
    const currentRootId = GraphEngineSupport.schemaId(currentGraph.rootSchema);
    const cacheKey = `${currentRootId ?? '<anonymous>'}::${ref}`;

    return this.refCache.get(cacheKey);
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
    target: RefTargetType
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
    node: SchemaGraphNodeType,
    graph: SchemaGraphInterface,
    dynamicScope: DynamicScopeEntryType[]
  ): unknown {
    return GraphEngineDefaults.synthesizeZeroValue(this.cachedDefaultResolutionContext, node, graph, dynamicScope);
  }

  private validateArray(
    graph: SchemaGraphInterface,
    value: unknown[],
    path: string,
    options: EffectiveOptionsType,
    refStack: Set<string>,
    dynamicScope: DynamicScopeEntryType[],
    sem: SchemaGraphSemanticsType,
    depth: number
  ): InternalExecutionResultType {
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
      errors.push(this.createError(path, 'minItems', VALIDATION_MESSAGES.minItems(minItems), { 'limit': minItems }));
    }
    if (typeof maxItems === 'number' && workingValue.length > maxItems) {
      errors.push(this.createError(path, 'maxItems', VALIDATION_MESSAGES.maxItems(maxItems), { 'limit': maxItems }));
    }
  }

  private validateArrayContains(
    graph: SchemaGraphInterface,
    path: string,
    options: EffectiveOptionsType,
    refStack: Set<string>,
    dynamicScope: DynamicScopeEntryType[],
    sem: SchemaGraphSemanticsType,
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
      errors.push(this.createError(path, 'contains', VALIDATION_MESSAGES.contains(minimumContains), { 'minContains': minimumContains }));
    }
    if (maximumContains !== undefined && matches > maximumContains) {
      errors.push(this.createError(path, 'maxContains', VALIDATION_MESSAGES.maxContains(maximumContains), { 'maxContains': maximumContains }));
    }
  }

  private validateArrayItems(
    graph: SchemaGraphInterface,
    path: string,
    options: EffectiveOptionsType,
    refStack: Set<string>,
    dynamicScope: DynamicScopeEntryType[],
    itemsNode: SchemaGraphNodeType | undefined,
    workingValue: unknown[],
    evaluatedItems: Set<number>,
    errors: ValidationErrorType[],
    depth: number
  ): InternalExecutionResultType | undefined {
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
    dynamicScope: DynamicScopeEntryType[],
    sem: SchemaGraphSemanticsType,
    workingValue: unknown[],
    evaluatedItems: Set<number>,
    errors: ValidationErrorType[],
    depth: number
  ): InternalExecutionResultType | undefined {
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
          errors.push(this.createError(path, 'uniqueItems', VALIDATION_MESSAGES.uniqueItems));

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
          errors.push(this.createError(path, 'dependentRequired', VALIDATION_MESSAGES.dependentRequired(dependency, key), {
            dependency,
            key
          }));
        }
      }
    }
  }

  private validateDependentSchemas(
    dependentSchemaEntries: ReadonlyArray<readonly [string, SchemaGraphNodeType]>,
    workingValue: Record<string, unknown>,
    graph: SchemaGraphInterface,
    path: string,
    options: EffectiveOptionsType,
    refStack: Set<string>,
    dynamicScope: DynamicScopeEntryType[],
    evaluatedProperties: Set<string>,
    errors: ValidationErrorType[],
    depth: number
  ): InternalExecutionResultType | undefined {
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
    dynamicScope: DynamicScopeEntryType[],
    itemsNode: SchemaGraphNodeType | undefined,
    extraStart: number,
    workingValue: unknown[],
    evaluatedItems: Set<number>,
    errors: ValidationErrorType[],
    depth: number
  ): InternalExecutionResultType | undefined {
    if (itemsNode?.schema === false && workingValue.length > extraStart) {
      errors.push(this.createError(path, 'items', VALIDATION_MESSAGES.items));

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
    sem: SchemaGraphSemanticsType
  ): ValidationErrorType[] {
    const { formatAssertions } = this.dialectPlan;

    return GraphEngineScalars.validateNumberConstraints(path, value, sem, this.formatRegistry, formatAssertions);
  }

  private validateObject(
    node: SchemaGraphNodeType,
    graph: SchemaGraphInterface,
    value: Record<string, unknown>,
    path: string,
    options: EffectiveOptionsType,
    refStack: Set<string>,
    dynamicScope: DynamicScopeEntryType[],
    depth: number
  ): InternalExecutionResultType {
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
      errors.push(this.createError(path, 'minProperties', VALIDATION_MESSAGES.minProperties(minProperties), { 'limit': minProperties }));
    }
    if (typeof maxProperties === 'number' && objectKeys.length > maxProperties) {
      errors.push(this.createError(path, 'maxProperties', VALIDATION_MESSAGES.maxProperties(maxProperties), { 'limit': maxProperties }));
    }
  }

  private validateObjectConstraints(
    sem: SchemaGraphSemanticsType,
    graph: SchemaGraphInterface,
    workingValue: Record<string, unknown>,
    path: string,
    options: EffectiveOptionsType,
    refStack: Set<string>,
    dynamicScope: DynamicScopeEntryType[],
    evaluatedProperties: Set<string>,
    errors: ValidationErrorType[],
    iterKeys: string[],
    patternPropertyEntries: Array<{ 'node': SchemaGraphNodeType;
      'pattern': string;
      'regex': RegExp }>,
    depth: number
  ): InternalExecutionResultType | undefined {
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
    propertyNodeMap: ReadonlyMap<string, SchemaGraphNodeType>,
    patternPropertyEntries: Array<{ 'node': SchemaGraphNodeType;
      'pattern': string;
      'regex': RegExp }>,
    propertyNamesNode: SchemaGraphNodeType | undefined,
    graph: SchemaGraphInterface,
    workingValue: Record<string, unknown>,
    path: string,
    options: EffectiveOptionsType,
    refStack: Set<string>,
    dynamicScope: DynamicScopeEntryType[],
    evaluatedProperties: Set<string>,
    errors: ValidationErrorType[],
    depth: number
  ): InternalExecutionResultType | undefined {
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
        const child = this.visit(propNode, graph, workingValue[key], `${path}/${SchemaGraphSupport.escapeJsonPointerSegment(key)}`, options, refStack, dynamicScope, depth + 1);

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
    patternPropertyEntries: Array<{ 'node': SchemaGraphNodeType;
      'pattern': string;
      'regex': RegExp }>,
    graph: SchemaGraphInterface,
    workingValue: Record<string, unknown>,
    path: string,
    options: EffectiveOptionsType,
    refStack: Set<string>,
    dynamicScope: DynamicScopeEntryType[],
    evaluatedProperties: Set<string>,
    errors: ValidationErrorType[],
    depth: number
  ): InternalExecutionResultType | undefined {
    for (const patternEntry of patternPropertyEntries) {
      if (!patternEntry.regex.test(key)) {
        continue;
      }
      const child = this.visit(patternEntry.node, graph, workingValue[key], `${path}/${SchemaGraphSupport.escapeJsonPointerSegment(key)}`, options, refStack, dynamicScope, depth + 1);

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
    propertyNamesNode: SchemaGraphNodeType | undefined,
    graph: SchemaGraphInterface,
    path: string,
    options: EffectiveOptionsType,
    refStack: Set<string>,
    dynamicScope: DynamicScopeEntryType[],
    errors: ValidationErrorType[],
    depth: number
  ): InternalExecutionResultType | undefined {
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
        'path': `${path}/${SchemaGraphSupport.escapeJsonPointerSegment(key)}`
      };
    }));

    return undefined;
  }

  private validateString(
    path: string,
    value: string,
    sem: SchemaGraphSemanticsType
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
    node: SchemaGraphNodeType,
    graph: SchemaGraphInterface,
    value: unknown,
    path: string,
    options: EffectiveOptionsType,
    refStack: Set<string>,
    dynamicScope: DynamicScopeEntryType[],
    depth = 0
  ): InternalExecutionResultType {
    const ctx = this.cachedVisitContext;

    return GraphEngineVisit.visit(ctx, node, graph, value, path, options, refStack, dynamicScope, depth);
  }

  private visitContext(): VisitContextType {
    return {
      ...this.visitContextResolution(),
      ...this.visitContextUnevaluated(),
      ...this.visitContextValidators()
    };
  }

  private visitContextResolution(): Pick<VisitContextType, 'coerceValue' | 'createError' | 'customKeywords' | 'graphFor' | 'matchesType' | 'resolveDynamicRef' | 'resolveRef' | 'synthesizeZeroValue'> {
    return {
      'coerceValue': (schemaTypes: string[], value: unknown, materializeContainers: boolean): unknown => {
        return GraphEngineScalars.coerceGraphValue(schemaTypes, value, materializeContainers);
      },
      'createError': (path: string, keyword: string, message: string, params?: Record<string, unknown>): ValidationErrorType => {
        return this.createError(path, keyword, message, params);
      },
      'customKeywords': this.customKeywords,
      'graphFor': (rootSchema: boolean | Record<string, unknown>): SchemaGraphInterface => {
        return this.graphFor(rootSchema);
      },
      'matchesType': (schemaTypes: string[], value: unknown): boolean => {
        return GraphEngineScalars.matchesSchemaTypes(schemaTypes, value);
      },
      'resolveDynamicRef': (ref: string, currentGraph: SchemaGraphInterface, dynamicScope: DynamicScopeEntryType[]): RefTargetType => {
        return this.resolveDynamicRef(ref, currentGraph, dynamicScope);
      },
      'resolveRef': (ref: string, currentGraph: SchemaGraphInterface): RefTargetType => {
        return this.resolveRef(ref, currentGraph);
      },
      'synthesizeZeroValue': (node: SchemaGraphNodeType, graph: SchemaGraphInterface, dynamicScope: DynamicScopeEntryType[]): unknown => {
        return this.synthesizeZeroValue(node, graph, dynamicScope);
      }
    };
  }

  private visitContextUnevaluated(): Pick<VisitContextType, 'applyUnevaluatedItems' | 'applyUnevaluatedProperties'> {
    return {
      'applyUnevaluatedItems': (
        node: SchemaGraphNodeType,
        graph: SchemaGraphInterface,
        value: unknown[],
        path: string,
        options: EffectiveOptionsType,
        refStack: Set<string>,
        dynamicScope: DynamicScopeEntryType[],
        alreadyEvaluated: Set<number>,
        depth: number
      ): InternalExecutionResultType => {
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
        node: SchemaGraphNodeType,
        graph: SchemaGraphInterface,
        value: Record<string, unknown>,
        path: string,
        opts: EffectiveOptionsType,
        refStack: Set<string>,
        dynScope: DynamicScopeEntryType[],
        evaluated: Set<string>,
        depth: number
      ): InternalExecutionResultType => {
        return this.applyUnevaluatedProperties(node, graph, value, path, opts, refStack, dynScope, evaluated, depth);
      }
    };
  }

  private visitContextValidators(): Pick<VisitContextType, 'validateArray' | 'validateNumber' | 'validateObject' | 'validateString'> {
    return {
      'validateArray': (
        graph: SchemaGraphInterface,
        value: unknown[],
        path: string,
        options: EffectiveOptionsType,
        refStack: Set<string>,
        dynamicScope: DynamicScopeEntryType[],
        sem: SchemaGraphSemanticsType,
        depth: number
      ): InternalExecutionResultType => {
        return this.validateArray(graph, value, path, options, refStack, dynamicScope, sem, depth);
      },
      'validateNumber': (path: string, value: number, sem: SchemaGraphSemanticsType): ValidationErrorType[] => {
        return this.validateNumber(path, value, sem);
      },
      'validateObject': (
        node: SchemaGraphNodeType,
        graph: SchemaGraphInterface,
        value: Record<string, unknown>,
        path: string,
        options: EffectiveOptionsType,
        refStack: Set<string>,
        dynamicScope: DynamicScopeEntryType[],
        depth: number
      ): InternalExecutionResultType => {
        return this.validateObject(node, graph, value, path, options, refStack, dynamicScope, depth);
      },
      'validateString': (path: string, value: string, sem: SchemaGraphSemanticsType): ValidationErrorType[] => {
        return this.validateString(path, value, sem);
      }
    };
  }
}
