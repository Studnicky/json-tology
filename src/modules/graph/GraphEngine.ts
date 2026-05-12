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
import {
  deepEqual, isRecord
} from '../data/DataTypes.js';
import { FormatRegistry } from '../format/FormatRegistry.js';
import { SchemaGraph } from './SchemaGraph.js';
import { GraphError } from '../../errors/GraphError.js';
import { DEFAULT_OPTIONS } from '../../constants/DIALECT.js';
import {
  buildRootDialectPlan,
  cloneCandidate,
  extractNamedFragment,
  parseRef,
  schemaId
} from './GraphEngineSupport.js';
import { escapeJsonPointerSegment } from './SchemaGraphSupport.js';
import type { DynamicScopeEntryInterface } from '../../interfaces/DynamicScopeEntry.js';
import type { InternalExecutionResultInterface } from '../../interfaces/InternalExecutionResult.js';
import type { RefTargetInterface } from '../../interfaces/RefTarget.js';
import type { RootDialectPlanInterface } from '../../interfaces/RootDialectPlan.js';
import {
  coerceGraphValue,
  matchesSchemaTypes,
  validateNumberConstraints,
  validateStringConstraints
} from './GraphEngineScalars.js';
import { BaseError } from '../../errors/BaseError.js';
import {
  createImplicitDefaultValue,
  synthesizeZeroValue
} from './GraphEngineDefaults.js';
import type { DefaultResolutionContextInterface } from '../../interfaces/DefaultResolutionContext.js';
import { visitNode } from './GraphEngineVisit.js';
import type { VisitContextInterface } from '../../interfaces/VisitContext.js';

import type { JSONSchema7Definition } from 'json-schema';

export class GraphEngine implements GraphEngineInterface {
  private readonly customKeywords: KeywordDefinitionInterface[];
  private readonly dialectPlan: RootDialectPlanInterface;
  public readonly formatRegistry: FormatRegistryInterface;
  private readonly graphCache = new WeakMap<object, SchemaGraph>();
  private readonly options: Pick<GraphEngineOptionsInterface, 'lookupSchema'> & Required<Omit<GraphEngineOptionsInterface, 'formatRegistry' | 'keywords' | 'lookupSchema'>>;
  private readonly refCache = new Map<string, RefTargetInterface>();
  private readonly regexCache = new Map<string, RegExp>();

  /**
   * Creates a new graph engine for the given root schema.
   *
   * @param rootSchema - The JSON Schema definition used as the root of this engine.
   * @param options - Engine configuration including format registry, custom keywords, and lookup function.
   */
  public constructor(public readonly rootSchema: JSONSchema7Definition, options: GraphEngineOptionsInterface = {}) {
    const {
      formatRegistry, keywords, ...rest
    } = options;

    this.formatRegistry = formatRegistry ?? FormatRegistry.builtin();
    this.customKeywords = keywords ?? [];
    this.options = {
      ...DEFAULT_OPTIONS,
      ...rest
    };
    this.dialectPlan = buildRootDialectPlan(rootSchema);
  }

  private applyUnevaluatedItems(
    node: SchemaGraphNodeInterface,
    graph: SchemaGraphInterface,
    value: unknown[],
    path: string,
    options: Pick<GraphEngineOptionsInterface, 'lookupSchema'> & Required<Omit<GraphEngineOptionsInterface, 'formatRegistry' | 'keywords' | 'lookupSchema'>>,
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
      'evaluatedProperties': new Set(),
      'valid': errors.length === 0,
      'value': workingValue
    };
  }

  private applyUnevaluatedProperties(
    node: SchemaGraphNodeInterface,
    graph: SchemaGraphInterface,
    value: Record<string, unknown>,
    path: string,
    options: Pick<GraphEngineOptionsInterface, 'lookupSchema'> & Required<Omit<GraphEngineOptionsInterface, 'formatRegistry' | 'keywords' | 'lookupSchema'>>,
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
          errors.push(this.createError(`${path}/${escapeJsonPointerSegment(key)}`, 'unevaluatedProperties', 'must NOT have unevaluated properties', { 'unevaluatedProperty': key }));
        }
        continue;
      }
      const child = this.visit(unevaluatedPropertiesNode, graph, workingValue[key], `${path}/${escapeJsonPointerSegment(key)}`, options, refStack, dynamicScope, depth + 1);

      if (!child.valid && !options.collectErrors) {
        return child;
      }
      workingValue[key] = child.value;
      evaluatedProperties.add(key);
      errors.push(...child.errors);
    }

    return {
      errors,
      'evaluatedItems': new Set(),
      evaluatedProperties,
      'valid': errors.length === 0,
      'value': workingValue
    };
  }

  /**
   * Returns whether a value is valid against the schema at the given pointer.
   *
   * @param value - The value to validate.
   * @param options - Optional settings including a JSON Pointer into the root schema.
   * @returns `true` if the value passes validation, `false` otherwise.
   */
  public check(value: unknown, options?: { 'pointer'?: string }): boolean {
    return this.execute(value, {
      'overrides': { 'collectErrors': false },
      'pointer': options?.pointer ?? ''
    }).valid;
  }

  private coerceValue(schemaTypes: string[], value: unknown, materializeContainers: boolean): unknown {
    return coerceGraphValue(schemaTypes, value, materializeContainers);
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
    dynamicScope: DynamicScopeEntryInterface[],
    visited = new Set<string>()
  ): unknown {
    return createImplicitDefaultValue(this.defaultResolutionContext(), node, graph, dynamicScope, visited);
  }

  private defaultResolutionContext(): DefaultResolutionContextInterface {
    return {
      'resolveDynamicRef': (ref, currentGraph, dynamicScope) => {
        return this.resolveDynamicRef(ref, currentGraph, dynamicScope);
      },
      'resolveRef': (ref, currentGraph) => {
        return this.resolveRef(ref, currentGraph);
      }
    };
  }

  /**
   * Collects all validation errors for a value against the schema at the given pointer.
   *
   * @param value - The value to validate.
   * @param options - Optional settings including a JSON Pointer into the root schema.
   * @returns An array of validation errors, empty when the value is valid.
   */
  public errors(value: unknown, options?: { 'pointer'?: string }): ValidationErrorType[] {
    return this.execute(value, {
      'overrides': { 'collectErrors': true },
      'pointer': options?.pointer ?? ''
    }).errors;
  }

  /**
   * Executes the full graph-based validation and normalization pipeline for a value.
   *
   * @param value - The value to validate and normalize.
   * @param options - Optional pointer and per-call option overrides merged on top of the engine defaults.
   * @returns The execution result containing validity, errors, normalized value, and graph metadata.
   * @throws {@link GraphError} If the pointer cannot be resolved in the graph.
   */
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
    const effective = {
      ...this.options,
      ...overrides
    };

    const result = this.visit(entryNode, graph, value, '', effective, new Set(), []);

    return {
      entryNode,
      'errors': result.errors,
      'evaluatedItems': result.evaluatedItems,
      'evaluatedProperties': result.evaluatedProperties,
      graph,
      'valid': result.valid,
      'value': result.value
    };
  }

  private graphFor(rootSchema: JSONSchema7Definition): SchemaGraphInterface {
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

  /**
   * Indicates whether the engine was configured with custom keyword definitions.
   *
   * @returns `true` if at least one custom keyword is registered.
   */
  public hasRegisteredCustomKeywords(): boolean {
    return this.customKeywords.length > 0;
  }

  /**
   * Returns the list of custom keyword definitions registered with this engine.
   *
   * @returns The custom keyword definitions array.
   */
  public keywords(): KeywordDefinitionInterface[] {
    return this.customKeywords;
  }

  private matchesType(schemaTypes: string[], value: unknown): boolean {
    return matchesSchemaTypes(schemaTypes, value);
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
    const fragment = extractNamedFragment(ref);
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
    const currentRootId = schemaId(currentGraph.rootSchema);
    const cacheKey = `${currentRootId ?? '<anonymous>'}::${ref}`;
    const cached = this.refCache.get(cacheKey);

    if (cached !== undefined) {
      return cached;
    }

    let graph = currentGraph;
    let fragment: string;

    if (ref.startsWith('#')) {
      fragment = ref.slice(1);
    } else {
      const parsed = parseRef(ref);

      fragment = parsed.fragment;

      const lookedUp = this.options.lookupSchema?.(parsed.id);

      if (lookedUp === undefined) {
        throw new GraphError('REF_UNRESOLVED', `Unresolved schema reference: ${ref}`, ref);
      }
      graph = this.graphFor(lookedUp);
    }

    const node = graph.resolveFragment(fragment);
    const target = {
      graph,
      node
    };

    this.refCache.set(cacheKey, target);

    return target;
  }

  /**
   * Returns the `$id` of the root schema, if one is declared.
   *
   * @returns The root schema's `$id` string, or `undefined` when absent.
   */
  public rootSchemaId(): string | undefined {
    return schemaId(this.rootSchema);
  }

  /**
   * Returns the schema lookup function provided at construction, if any.
   *
   * @returns The lookup callback, or `undefined` when none was configured.
   */
  public schemaLookup(): ((schemaId: string) => Record<string, unknown> | undefined) | undefined {
    return this.options.lookupSchema;
  }

  private synthesizeZeroValue(
    node: SchemaGraphNodeInterface,
    graph: SchemaGraphInterface,
    dynamicScope: DynamicScopeEntryInterface[]
  ): unknown {
    return synthesizeZeroValue(this.defaultResolutionContext(), node, graph, dynamicScope, new Set());
  }

  private validateArray(
    graph: SchemaGraphInterface,
    value: unknown[],
    path: string,
    options: Pick<GraphEngineOptionsInterface, 'lookupSchema'> & Required<Omit<GraphEngineOptionsInterface, 'formatRegistry' | 'keywords' | 'lookupSchema'>>,
    refStack: Set<string>,
    dynamicScope: DynamicScopeEntryInterface[],
    sem: SchemaGraphSemanticsInterface,
    depth: number
  ): InternalExecutionResultInterface {
    const errors: ValidationErrorType[] = [];
    const evaluatedItems = new Set<number>();
    const workingValue = value;
    const {
      containsNode,
      itemsNode,
      maxContains,
      maxItems,
      minContains,
      minItems,
      'prefixItems': prefixItemNodes,
      uniqueItems
    } = sem;

    if (typeof minItems === 'number' && workingValue.length < minItems) {
      errors.push(this.createError(path, 'minItems', `must have at least ${minItems} items`, { 'limit': minItems }));
    }
    if (typeof maxItems === 'number' && workingValue.length > maxItems) {
      errors.push(this.createError(path, 'maxItems', `must have at most ${maxItems} items`, { 'limit': maxItems }));
    }
    if (uniqueItems) {
      for (let index = 0; index < workingValue.length; index++) {
        const item = workingValue[index];

        if (workingValue.slice(index + 1).some((candidate) => {
          return deepEqual(item, candidate);
        })) {
          errors.push(this.createError(path, 'uniqueItems', 'must NOT have duplicate items'));

          break;
        }
      }
    }

    if (prefixItemNodes.length > 0) {
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

      const extraStart = prefixItemNodes.length;

      if (itemsNode?.schema === false && workingValue.length > extraStart) {
        errors.push(this.createError(path, 'items', 'must NOT have items beyond prefixItems'));
      } else if (itemsNode !== undefined && itemsNode.schema !== true && itemsNode.schema !== false) {
        for (let index = extraStart; index < workingValue.length; index++) {
          const child = this.visit(itemsNode, graph, workingValue[index], `${path}/${index}`, options, refStack, dynamicScope, depth + 1);

          if (!child.valid && !options.collectErrors) {
            return child;
          }
          workingValue[index] = child.value;
          evaluatedItems.add(index);
          errors.push(...child.errors);
        }
      }
    } else {
      if (itemsNode !== undefined) {
        for (let index = 0; index < workingValue.length; index++) {
          const child = this.visit(itemsNode, graph, workingValue[index], `${path}/${index}`, options, refStack, dynamicScope, depth + 1);

          if (!child.valid && !options.collectErrors) {
            return child;
          }
          workingValue[index] = child.value;
          evaluatedItems.add(index);
          errors.push(...child.errors);
        }
      }
    }

    if (containsNode !== undefined) {
      let matches = 0;

      for (const [
        index,
        element
      ] of workingValue.entries()) {
        const candidate = this.visit(containsNode, graph, cloneCandidate(element), `${path}/${index}`, {
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

    return {
      errors,
      evaluatedItems,
      'evaluatedProperties': new Set(),
      'valid': errors.length === 0,
      'value': workingValue
    };
  }

  private validateNumber(
    path: string,
    value: number,
    sem: SchemaGraphSemanticsInterface
  ): ValidationErrorType[] {
    return validateNumberConstraints(path, value, sem, this.formatRegistry, this.dialectPlan.formatAssertions);
  }

  private validateObject(
    node: SchemaGraphNodeInterface,
    graph: SchemaGraphInterface,
    value: Record<string, unknown>,
    path: string,
    options: Pick<GraphEngineOptionsInterface, 'lookupSchema'> & Required<Omit<GraphEngineOptionsInterface, 'formatRegistry' | 'keywords' | 'lookupSchema'>>,
    refStack: Set<string>,
    dynamicScope: DynamicScopeEntryInterface[],
    depth: number
  ): InternalExecutionResultInterface {
    const errors: ValidationErrorType[] = [];
    const evaluatedProperties = new Set<string>();
    const sem = graph.semantics(node);
    const propertyEntries = sem.properties;
    const propertyNodeMap = sem.properties;
    const required = sem.required;
    const patternPropertyEntries = sem.patternPropertyEntries.map(([
      pattern,
      patternNode
    ]) => {
      return {
        'node': patternNode,
        pattern,
        'regex': this.regexFor(pattern)
      };
    });
    const dependentRequired = sem.dependentRequired;
    const dependentSchemaEntries = sem.dependentSchemaEntries;
    const workingValue = value;

    for (const [
      canonicalKey,
      propNode
    ] of propertyEntries) {
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
    const {
      additionalPropertiesNode,
      maxProperties,
      minProperties
    } = sem;
    const propertyNamesNode = sem.propertyNamesNode;

    if (typeof minProperties === 'number' && Object.keys(workingValue).length < minProperties) {
      errors.push(this.createError(path, 'minProperties', `must NOT have fewer than ${minProperties} properties`, { 'limit': minProperties }));
    }
    if (typeof maxProperties === 'number' && Object.keys(workingValue).length > maxProperties) {
      errors.push(this.createError(path, 'maxProperties', `must NOT have more than ${maxProperties} properties`, { 'limit': maxProperties }));
    }

    if (options.applyDefaults) {
      for (const [
        key,
        propNode
      ] of propertyEntries) {
        if (key in workingValue) {
          continue;
        }
        const prepared = this.createImplicitDefault(propNode, graph, dynamicScope);

        if (prepared !== undefined) {
          workingValue[key] = prepared;
        }
      }
    }

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

    for (const key of Object.keys(workingValue)) {
      if (propertyNamesNode !== undefined) {
        const propertyNameResult = this.visit(propertyNamesNode, graph, key, path, {
          ...options,
          'applyDefaults': false,
          'removeAdditionalProperties': false
        }, refStack, dynamicScope, depth + 1);

        if (!propertyNameResult.valid && !options.collectErrors) {
          return propertyNameResult;
        }
        errors.push(...propertyNameResult.errors.map((error) => {
          return {
            ...error,
            'path': `${path}/${escapeJsonPointerSegment(key)}`
          };
        }));
      }

      if (propertyNodeMap.has(key)) {
        const propNode = propertyNodeMap.get(key);

        if (propNode === undefined) {
          throw new GraphError('POINTER_NOT_FOUND', `Property node not found for key: ${key}`, key);
        }
        const child = this.visit(propNode, graph, workingValue[key], `${path}/${escapeJsonPointerSegment(key)}`, options, refStack, dynamicScope, depth + 1);

        if (!child.valid && !options.collectErrors) {
          return child;
        }
        workingValue[key] = child.value;
        evaluatedProperties.add(key);
        errors.push(...child.errors);
      }

      for (const patternEntry of patternPropertyEntries) {
        if (patternEntry.regex.test(key)) {
          const child = this.visit(patternEntry.node, graph, workingValue[key], `${path}/${escapeJsonPointerSegment(key)}`, options, refStack, dynamicScope, depth + 1);

          if (!child.valid && !options.collectErrors) {
            return child;
          }
          workingValue[key] = child.value;
          evaluatedProperties.add(key);
          errors.push(...child.errors);
        }
      }
    }

    if (Object.keys(dependentRequired).length > 0) {
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

    if (dependentSchemaEntries.length > 0) {
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
        for (const evaluated of child.evaluatedProperties) {
          evaluatedProperties.add(evaluated);
        }
      }
    }

    const applyAdditional = (key: string): void => {
      if (options.allowAdditionalProperties) {
        return;
      }

      const additionalProperties = additionalPropertiesNode;

      if (additionalProperties === false) {
        if (options.removeAdditionalProperties) {
          delete workingValue[key];
        } else {
          errors.push(this.createError(`${path}/${escapeJsonPointerSegment(key)}`, 'additionalProperties', 'must NOT have additional properties', { 'additionalProperty': key }));
        }

        return;
      }

      if (additionalProperties === undefined || additionalProperties === true) {
        if (options.enforceSchemaProperties) {
          delete workingValue[key];
        }

        return;
      }

      const child = this.visit(additionalProperties, graph, workingValue[key], `${path}/${escapeJsonPointerSegment(key)}`, options, refStack, dynamicScope, depth + 1);

      if (child.valid) {
        workingValue[key] = child.value;
        evaluatedProperties.add(key);
      } else {
        errors.push(...child.errors);
      }
    };

    for (const key of Object.keys(workingValue)) {
      if (!evaluatedProperties.has(key)) {
        applyAdditional(key);
      }
    }

    return {
      errors,
      'evaluatedItems': new Set(),
      evaluatedProperties,
      'valid': errors.length === 0,
      'value': workingValue
    };
  }

  private validateString(
    path: string,
    value: string,
    sem: SchemaGraphSemanticsInterface
  ): ValidationErrorType[] {
    return validateStringConstraints(
      path,
      value,
      sem,
      (pattern) => {
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
    options: Pick<GraphEngineOptionsInterface, 'lookupSchema'> & Required<Omit<GraphEngineOptionsInterface, 'formatRegistry' | 'keywords' | 'lookupSchema'>>,
    refStack: Set<string>,
    dynamicScope: DynamicScopeEntryInterface[],
    depth = 0
  ): InternalExecutionResultInterface {
    return visitNode(this.visitContext(), node, graph, value, path, options, refStack, dynamicScope, depth);
  }

  private visitContext(): VisitContextInterface {
    return {
      'applyUnevaluatedItems': (...args) => {
        return this.applyUnevaluatedItems(...args);
      },
      'applyUnevaluatedProperties': (node, graph, value, path, opts, refStack, dynScope, evaluated, depth) => {
        return this.applyUnevaluatedProperties(node, graph, value, path, opts, refStack, dynScope, evaluated, depth);
      },
      'coerceValue': (schemaTypes, value, materializeContainers) => {
        return this.coerceValue(schemaTypes, value, materializeContainers);
      },
      'createError': (path, keyword, message, params) => {
        return this.createError(path, keyword, message, params);
      },
      'customKeywords': this.customKeywords,
      'graphFor': (rootSchema) => {
        return this.graphFor(rootSchema);
      },
      'matchesType': (schemaTypes, value) => {
        return this.matchesType(schemaTypes, value);
      },
      'resolveDynamicRef': (ref, currentGraph, dynamicScope) => {
        return this.resolveDynamicRef(ref, currentGraph, dynamicScope);
      },
      'resolveRef': (ref, currentGraph) => {
        return this.resolveRef(ref, currentGraph);
      },
      'synthesizeZeroValue': (node, graph, dynamicScope) => {
        return this.synthesizeZeroValue(node, graph, dynamicScope);
      },
      'validateArray': (graph, value, path, options, refStack, dynamicScope, sem, depth) => {
        return this.validateArray(graph, value, path, options, refStack, dynamicScope, sem, depth);
      },
      'validateNumber': (path, value, sem) => {
        return this.validateNumber(path, value, sem);
      },
      'validateObject': (node, graph, value, path, options, refStack, dynamicScope, depth) => {
        return this.validateObject(node, graph, value, path, options, refStack, dynamicScope, depth);
      },
      'validateString': (path, value, sem) => {
        return this.validateString(path, value, sem);
      }
    };
  }
}
