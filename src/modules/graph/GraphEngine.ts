import type { ValidationErrorType } from '../../types/validation.js';
import type {
  GraphEngineOptionsInterface, GraphExecutionResultInterface,
  KeywordContextInterface, KeywordDefinitionInterface
} from '../../interfaces/graph-engine.js';
import type { GraphEngineInterface } from '../../interfaces/graph-engine-impl.js';
import type {
  SchemaGraphNodeInterface, SchemaGraphSemanticsInterface
} from '../../interfaces/schema-graph.js';
import type { FormatRegistryInterface } from '../../interfaces/format-registry.js';
import type { SchemaGraphInterface } from '../../interfaces/schema-graph-impl.js';
import {
  isRecord, propertyIri
} from '../data/DataTypes.js';
import { GraphError } from '../../errors/GraphError.js';
import { FormatRegistry } from '../format/FormatRegistry.js';
import { Hash } from '../hash/Hash.js';
import { SchemaGraph } from './SchemaGraph.js';


import type { JSONSchema7Definition as JsonSchemaType } from 'json-schema';

interface InternalExecutionResultInterface {
  'errors': ValidationErrorType[];
  'evaluatedItems': Set<number>;
  'evaluatedProperties': Set<string>;
  'valid': boolean;
  'value': unknown;
}

interface RefTargetInterface {
  'graph': SchemaGraphInterface;
  'node': SchemaGraphNodeInterface;
}

interface DynamicScopeEntryInterface {
  'anchor': string;
  'graph': SchemaGraphInterface;
  'node': SchemaGraphNodeInterface;
}

interface RootDialectPlanInterface {
  'formatAssertions': boolean;
}

const DEFAULT_OPTIONS: Required<Omit<GraphEngineOptionsInterface, 'formatRegistry' | 'keywords' | 'lookupSchema'>> = {
  'applyDefaults': false,
  'coerce': false,
  'collectErrors': true,
  'ignoreAdditionalProperties': false,
  'materializeContainers': false,
  'removeAdditional': false,
  'stripUnknownProperties': false,
  'synthesizeDefaults': false
};

const CURRENT_DIALECT_PREFIX = 'https://json-schema.org/draft/2020-12/';
const DEFAULT_DIALECT_URI = 'https://json-schema.org/draft/2020-12/schema';
const VOCABULARY_CORE = 'https://json-schema.org/draft/2020-12/vocab/core';
const VOCABULARY_APPLICATOR = 'https://json-schema.org/draft/2020-12/vocab/applicator';
const VOCABULARY_UNEVALUATED = 'https://json-schema.org/draft/2020-12/vocab/unevaluated';
const VOCABULARY_VALIDATION = 'https://json-schema.org/draft/2020-12/vocab/validation';
const VOCABULARY_METADATA = 'https://json-schema.org/draft/2020-12/vocab/meta-data';
const VOCABULARY_FORMAT_ANNOTATION = 'https://json-schema.org/draft/2020-12/vocab/format-annotation';
const VOCABULARY_FORMAT_ASSERTION = 'https://json-schema.org/draft/2020-12/vocab/format-assertion';
const VOCABULARY_CONTENT = 'https://json-schema.org/draft/2020-12/vocab/content';
const SUPPORTED_VOCABULARIES = new Set([
  VOCABULARY_APPLICATOR,
  VOCABULARY_CONTENT,
  VOCABULARY_CORE,
  VOCABULARY_FORMAT_ANNOTATION,
  VOCABULARY_FORMAT_ASSERTION,
  VOCABULARY_METADATA,
  VOCABULARY_UNEVALUATED,
  VOCABULARY_VALIDATION
]);

function cloneDefault<T>(value: T): T {
  return structuredClone(value);
}

function escapeJsonPointer(segment: string): string {
  return segment.replaceAll('~', '~0').replaceAll('/', '~1');
}

const isObject = isRecord;

function isInteger(value: unknown): boolean {
  return typeof value === 'number' && Number.isInteger(value);
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }
  if (typeof a !== typeof b) {
    return false;
  }
  if (typeof a !== 'object' || a === null || b === null) {
    return Number.isNaN(a) && Number.isNaN(b);
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      return false;
    }

    return a.every((entry, index) => {
      return deepEqual(entry, b[index]);
    });
  }

  const aKeys = Object.keys(a as Record<string, unknown>).sort();
  const bKeys = Object.keys(b as Record<string, unknown>).sort();

  if (!deepEqual(aKeys, bKeys)) {
    return false;
  }

  return aKeys.every((key) => {
    return deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]);
  });
}

function inferType(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return 'array';
  }

  return typeof value;
}


export class GraphEngine implements GraphEngineInterface {
  static escapeSegment(value: string): string {
    return encodeURIComponent(value).replaceAll('%2F', '/');
  }

  static hash(value: unknown): string {
    return Hash.value(value);
  }

  static propertyIri(classId: string, propertyName: string): string {
    return propertyIri(classId, propertyName);
  }

  private readonly customKeywords: KeywordDefinitionInterface[];
  private readonly dialectPlan: RootDialectPlanInterface;
  public readonly formatRegistry: FormatRegistryInterface;
  private readonly graphCache = new WeakMap<object, SchemaGraph>();
  private readonly options: Pick<GraphEngineOptionsInterface, 'lookupSchema'> & Required<Omit<GraphEngineOptionsInterface, 'formatRegistry' | 'keywords' | 'lookupSchema'>>;
  private readonly refCache = new Map<string, RefTargetInterface>();
  private readonly regexCache = new Map<string, RegExp>();

  public constructor(public readonly rootSchema: JsonSchemaType, options: GraphEngineOptionsInterface = {}) {
    const {
      formatRegistry, keywords, ...rest
    } = options;

    this.formatRegistry = formatRegistry ?? FormatRegistry.builtin();
    this.customKeywords = keywords ?? [];
    this.options = {
      ...DEFAULT_OPTIONS,
      ...rest
    };
    this.dialectPlan = this.rootDialectPlan(rootSchema);
  }

  private applyUnevaluatedItems(
    _node: SchemaGraphNodeInterface,
    graph: SchemaGraphInterface,
    value: unknown[],
    path: string,
    options: Pick<GraphEngineOptionsInterface, 'lookupSchema'> & Required<Omit<GraphEngineOptionsInterface, 'formatRegistry' | 'keywords' | 'lookupSchema'>>,
    refStack: Set<string>,
    dynamicScope: DynamicScopeEntryInterface[],
    alreadyEvaluated: Set<number>
  ): InternalExecutionResultInterface {
    const errors: ValidationErrorType[] = [];
    const evaluatedItems = new Set<number>();
    const workingValue = value;
    const sem = graph.semantics(_node);
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
      const child = this.visit(unevaluatedItemsNode, graph, workingValue[index], `${path}/${index}`, options, refStack, dynamicScope);

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
    _node: SchemaGraphNodeInterface,
    graph: SchemaGraphInterface,
    value: Record<string, unknown>,
    path: string,
    options: Pick<GraphEngineOptionsInterface, 'lookupSchema'> & Required<Omit<GraphEngineOptionsInterface, 'formatRegistry' | 'keywords' | 'lookupSchema'>>,
    refStack: Set<string>,
    dynamicScope: DynamicScopeEntryInterface[],
    alreadyEvaluated: Set<string>
  ): InternalExecutionResultInterface {
    const errors: ValidationErrorType[] = [];
    const evaluatedProperties = new Set<string>();
    const workingValue = value;
    const sem = graph.semantics(_node);
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
          errors.push(this.createError(`${path}/${escapeJsonPointer(key)}`, 'unevaluatedProperties', 'must NOT have unevaluated properties', { 'unevaluatedProperty': key }));
        }
        continue;
      }
      const child = this.visit(unevaluatedPropertiesNode, graph, workingValue[key], `${path}/${escapeJsonPointer(key)}`, options, refStack, dynamicScope);

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

  public check(value: unknown, pointer = ''): boolean {
    return this.execute(value, pointer, { 'collectErrors': false }).valid;
  }

  private coerceValue(schemaTypes: string[], value: unknown, materializeContainers: boolean): unknown {
    if (value === undefined || value === null || schemaTypes.length === 0) {
      if (!materializeContainers || value !== null) {
        return value;
      }
      if (schemaTypes.includes('object')) {
        return {};
      }
      if (schemaTypes.includes('array')) {
        return [];
      }

      return value;
    }

    if ((schemaTypes.includes('number') || schemaTypes.includes('integer')) && typeof value === 'string') {
      const coerced = Number(value);

      if (!Number.isNaN(coerced)) {
        return schemaTypes.includes('integer') ? Math.trunc(coerced) : coerced;
      }
    }

    if (schemaTypes.includes('boolean') && typeof value === 'string') {
      if (value === 'true' || value === '1') {
        return true;
      }
      if (value === 'false' || value === '0') {
        return false;
      }
    }

    if (schemaTypes.includes('null') && value === 'null') {
      return null;
    }

    if (schemaTypes.includes('string') && typeof value !== 'string') {
      return String(value);
    }

    if (materializeContainers) {
      if (schemaTypes.includes('object') && !isObject(value)) {
        return {};
      }
      if (schemaTypes.includes('array') && !Array.isArray(value)) {
        return [];
      }
    }

    return value;
  }

  private createError(
    path: string,
    keyword: string,
    message: string,
    params: Record<string, unknown> = {}
  ): ValidationErrorType {
    return {
      keyword,
      message,
      params,
      path
    };
  }

  private createImplicitDefault(
    node: SchemaGraphNodeInterface,
    graph: SchemaGraphInterface,
    options: Pick<GraphEngineOptionsInterface, 'lookupSchema'> & Required<Omit<GraphEngineOptionsInterface, 'formatRegistry' | 'keywords' | 'lookupSchema'>>,
    refStack: Set<string>,
    dynamicScope: DynamicScopeEntryInterface[],
    visited = new Set<string>()
  ): unknown {
    if (typeof node.schema === 'boolean') {
      return undefined;
    }

    if (visited.has(node.id)) {
      return undefined;
    }
    visited.add(node.id);

    const sem = graph.semantics(node);
    const defaultValue = sem.hasDefault ? sem.defaultValue : undefined;
    const ref = sem.ref;
    const dynamicRef = sem.dynamicRef;
    const schemaTypes = sem.schemaTypes;

    if (defaultValue !== undefined) {
      return cloneDefault(defaultValue);
    }
    if (typeof ref === 'string') {
      const resolved = this.resolveRef(ref, graph);

      return this.createImplicitDefault(resolved.node, resolved.graph, options, refStack, dynamicScope, visited);
    }
    if (typeof dynamicRef === 'string') {
      const resolved = this.resolveDynamicRef(dynamicRef, graph, dynamicScope);

      return this.createImplicitDefault(resolved.node, resolved.graph, options, refStack, dynamicScope, visited);
    }

    const hasProperties = sem.properties.size > 0;

    if (schemaTypes.includes('object') || hasProperties) {
      const result: Record<string, unknown> = {};
      let hasValue = false;

      for (const [
        key,
        childNode
      ] of sem.properties) {
        const childValue = this.createImplicitDefault(childNode, graph, options, refStack, dynamicScope, visited);

        if (childValue !== undefined) {
          result[key] = childValue;
          hasValue = true;
        }
      }

      return hasValue ? result : undefined;
    }

    return undefined;
  }


  public errors(value: unknown, pointer = ''): ValidationErrorType[] {
    return this.execute(value, pointer, { 'collectErrors': true }).errors;
  }

  public execute(
    value: unknown,
    pointer = '',
    overrides: Partial<Omit<GraphEngineOptionsInterface, 'formatRegistry' | 'lookupSchema'>> = {}
  ): GraphExecutionResultInterface {
    const graph = this.graphFor(this.rootSchema);
    const entryNode = graph.resolvePointer(pointer);
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

  private extractNamedFragment(ref: string): string | undefined {
    const hashIndex = ref.indexOf('#');

    if (hashIndex === -1) {
      return undefined;
    }

    const fragment = ref.slice(hashIndex + 1);

    if (fragment === '' || fragment.startsWith('/')) {
      return undefined;
    }

    return fragment;
  }

  private graphFor(rootSchema: JsonSchemaType): SchemaGraphInterface {
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

  public hasCustomKeywords(): boolean {
    return this.customKeywords.length > 0;
  }

  public keywords(): KeywordDefinitionInterface[] {
    return this.customKeywords;
  }

  private matchesType(schemaTypes: string[], value: unknown): boolean {
    return schemaTypes.some((schemaType) => {
      switch (schemaType) {
        case 'array':
          return Array.isArray(value);
        case 'integer':
          return isInteger(value);
        case 'null':
          return value === null;
        case 'number':
          return typeof value === 'number' && !Number.isNaN(value);
        case 'object':
          return isObject(value);
        default:
          return inferType(value) === schemaType;
      }
    });
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
    const fragment = this.extractNamedFragment(ref);
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
    const currentRootId = this.schemaId(currentGraph.rootSchema);
    const cacheKey = `${currentRootId ?? '<anonymous>'}::${ref}`;
    const cached = this.refCache.get(cacheKey);

    if (cached !== undefined) {
      return cached;
    }

    let graph = currentGraph;
    let fragment = '';

    if (ref.startsWith('#')) {
      fragment = ref.slice(1);
    } else {
      const hashIndex = ref.indexOf('#');
      const schemaId = hashIndex === -1 ? ref : ref.slice(0, hashIndex);

      fragment = hashIndex === -1 ? '' : ref.slice(hashIndex + 1);

      const lookedUp = this.options.lookupSchema?.(schemaId);

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

  private rootDialectPlan(rootSchema: JsonSchemaType): RootDialectPlanInterface {
    if (!isObject(rootSchema)) {
      return { 'formatAssertions': true };
    }

    const schemaUri = typeof rootSchema.$schema === 'string' ? rootSchema.$schema : undefined;

    if (schemaUri !== undefined && !schemaUri.startsWith(CURRENT_DIALECT_PREFIX)) {
      throw new GraphError('DIALECT_UNSUPPORTED', `Unsupported JSON Schema dialect: ${schemaUri}`);
    }

    const rawVocabulary = isObject(rootSchema.$vocabulary)
      ? rootSchema.$vocabulary
      : undefined;
    let formatAssertions = schemaUri === undefined ? true : false;

    if (rawVocabulary !== undefined) {
      for (const [
        uri,
        enabled
      ] of Object.entries(rawVocabulary)) {
        if (enabled === true && !SUPPORTED_VOCABULARIES.has(uri)) {
          throw new GraphError('VOCABULARY_UNSUPPORTED', `Unsupported required JSON Schema vocabulary: ${uri}`);
        }
      }

      if (typeof rawVocabulary[VOCABULARY_FORMAT_ASSERTION] === 'boolean') {
        formatAssertions = rawVocabulary[VOCABULARY_FORMAT_ASSERTION];
      }
    } else if (schemaUri === DEFAULT_DIALECT_URI) {
      formatAssertions = false;
    }

    return { formatAssertions };
  }

  public rootSchemaId(): string | undefined {
    return this.schemaId(this.rootSchema);
  }

  private schemaId(schema: JsonSchemaType): string | undefined {
    if (!isObject(schema)) {
      return undefined;
    }

    return typeof schema.$id === 'string' ? schema.$id : undefined;
  }

  public schemaLookup(): ((schemaId: string) => Record<string, unknown> | undefined) | undefined {
    return this.options.lookupSchema;
  }

  private synthesizeZeroValue(
    node: SchemaGraphNodeInterface,
    graph: SchemaGraphInterface,
    options: Pick<GraphEngineOptionsInterface, 'lookupSchema'> & Required<Omit<GraphEngineOptionsInterface, 'formatRegistry' | 'keywords' | 'lookupSchema'>>,
    refStack: Set<string>,
    dynamicScope: DynamicScopeEntryInterface[],
    visited = new Set<string>()
  ): unknown {
    if (typeof node.schema === 'boolean') {
      return null;
    }

    if (visited.has(node.id)) {
      return undefined;
    }
    visited.add(node.id);

    const sem = graph.semantics(node);

    if (sem.hasDefault) {
      return cloneDefault(sem.defaultValue);
    }
    if (sem.hasConst) {
      return sem.constValue;
    }
    if (sem.enumValues !== undefined && sem.enumValues.length > 0) {
      return sem.enumValues[0];
    }

    if (typeof sem.ref === 'string') {
      const resolved = this.resolveRef(sem.ref, graph);

      return this.synthesizeZeroValue(resolved.node, resolved.graph, options, refStack, dynamicScope, visited);
    }
    if (typeof sem.dynamicRef === 'string') {
      const resolved = this.resolveDynamicRef(sem.dynamicRef, graph, dynamicScope);

      return this.synthesizeZeroValue(resolved.node, resolved.graph, options, refStack, dynamicScope, visited);
    }

    const types = sem.schemaTypes;

    if (types.includes('string')) {
      return '';
    }
    if (types.includes('number') || types.includes('integer')) {
      return 0;
    }
    if (types.includes('boolean')) {
      return false;
    }
    if (types.includes('null')) {
      return null;
    }
    if (types.includes('array')) {
      return [];
    }
    if (types.includes('object') || sem.properties.size > 0) {
      return {};
    }

    return null;
  }

  private validateArray(
    graph: SchemaGraphInterface,
    value: unknown[],
    path: string,
    options: Pick<GraphEngineOptionsInterface, 'lookupSchema'> & Required<Omit<GraphEngineOptionsInterface, 'formatRegistry' | 'keywords' | 'lookupSchema'>>,
    refStack: Set<string>,
    dynamicScope: DynamicScopeEntryInterface[],
    sem: SchemaGraphSemanticsInterface
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
        const child = this.visit(itemNode, graph, workingValue[index], `${path}/${index}`, options, refStack, dynamicScope);

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
          const child = this.visit(itemsNode, graph, workingValue[index], `${path}/${index}`, options, refStack, dynamicScope);

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
          const child = this.visit(itemsNode, graph, workingValue[index], `${path}/${index}`, options, refStack, dynamicScope);

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
        }, refStack, dynamicScope);

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
    const errors: ValidationErrorType[] = [];
    const {
      'exclusiveMaximum': exclusiveMaximum,
      'exclusiveMinimum': exclusiveMinimum,
      format,
      maximum,
      minimum,
      multipleOf
    } = sem;

    if (minimum !== undefined && value < minimum) {
      errors.push(this.createError(path, 'minimum', `must be >= ${minimum}`, { 'limit': minimum }));
    }
    if (maximum !== undefined && value > maximum) {
      errors.push(this.createError(path, 'maximum', `must be <= ${maximum}`, { 'limit': maximum }));
    }
    if (exclusiveMinimum !== undefined && value <= exclusiveMinimum) {
      errors.push(this.createError(path, 'exclusiveMinimum', `must be > ${exclusiveMinimum}`, { 'limit': exclusiveMinimum }));
    }
    if (exclusiveMaximum !== undefined && value >= exclusiveMaximum) {
      errors.push(this.createError(path, 'exclusiveMaximum', `must be < ${exclusiveMaximum}`, { 'limit': exclusiveMaximum }));
    }
    if (multipleOf !== undefined) {
      const quotient = value / multipleOf;

      if (Math.abs(quotient - Math.round(quotient)) > Number.EPSILON * 10) {
        errors.push(this.createError(path, 'multipleOf', `must be multiple of ${multipleOf}`, { multipleOf }));
      }
    }
    if (format !== undefined) {
      const validator = this.formatRegistry.get(format);

      if (validator !== undefined && this.dialectPlan.formatAssertions && !validator(value)) {
        errors.push(this.createError(path, 'format', `must match format "${format}"`, { format }));
      }
    }

    return errors;
  }

  private validateObject(
    node: SchemaGraphNodeInterface,
    graph: SchemaGraphInterface,
    value: Record<string, unknown>,
    path: string,
    options: Pick<GraphEngineOptionsInterface, 'lookupSchema'> & Required<Omit<GraphEngineOptionsInterface, 'formatRegistry' | 'keywords' | 'lookupSchema'>>,
    refStack: Set<string>,
    dynamicScope: DynamicScopeEntryInterface[]
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
    const {
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
        const prepared = this.createImplicitDefault(propNode, graph, options, refStack, dynamicScope);

        if (prepared !== undefined) {
          workingValue[key] = prepared;
        }
      }
    }

    for (const key of required) {
      if (!(key in workingValue)) {
        const propNode = propertyNodeMap.get(key);

        if (options.applyDefaults && propNode !== undefined) {
          const prepared = this.createImplicitDefault(propNode, graph, options, refStack, dynamicScope);

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
            : this.synthesizeZeroValue(propNode, graph, options, refStack, dynamicScope);

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
          'removeAdditional': false
        }, refStack, dynamicScope);

        if (!propertyNameResult.valid && !options.collectErrors) {
          return propertyNameResult;
        }
        errors.push(...propertyNameResult.errors.map((error) => {
          return {
            ...error,
            'path': `${path}/${escapeJsonPointer(key)}`
          };
        }));
      }

      if (propertyNodeMap.has(key)) {
        const child = this.visit(propertyNodeMap.get(key)!, graph, workingValue[key], `${path}/${escapeJsonPointer(key)}`, options, refStack, dynamicScope);

        if (!child.valid && !options.collectErrors) {
          return child;
        }
        workingValue[key] = child.value;
        evaluatedProperties.add(key);
        errors.push(...child.errors);
      }

      for (const patternEntry of patternPropertyEntries) {
        if (patternEntry.regex.test(key)) {
          const child = this.visit(patternEntry.node, graph, workingValue[key], `${path}/${escapeJsonPointer(key)}`, options, refStack, dynamicScope);

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
        const child = this.visit(dependencyNode, graph, workingValue, path, options, refStack, dynamicScope);

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
      if (options.ignoreAdditionalProperties) {
        return;
      }

      const additionalProperties = sem.additionalPropertiesNode;

      if (additionalProperties === false) {
        if (options.removeAdditional) {
          delete workingValue[key];
        } else {
          errors.push(this.createError(`${path}/${escapeJsonPointer(key)}`, 'additionalProperties', 'must NOT have additional properties', { 'additionalProperty': key }));
        }

        return;
      }

      if (additionalProperties === undefined || additionalProperties === true) {
        if (options.stripUnknownProperties) {
          delete workingValue[key];
        }

        return;
      }

      const child = this.visit(additionalProperties, graph, workingValue[key], `${path}/${escapeJsonPointer(key)}`, options, refStack, dynamicScope);

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
    const errors: ValidationErrorType[] = [];
    const {
      format,
      'maxLength': maximum,
      'minLength': minimum,
      pattern
    } = sem;
    const valueLength = [...value].length;

    if (minimum !== undefined && valueLength < minimum) {
      errors.push(this.createError(path, 'minLength', `must NOT have fewer than ${minimum} characters`, { 'limit': minimum }));
    }
    if (maximum !== undefined && valueLength > maximum) {
      errors.push(this.createError(path, 'maxLength', `must NOT have more than ${maximum} characters`, { 'limit': maximum }));
    }
    if (pattern !== undefined && !this.regexFor(pattern).test(value)) {
      errors.push(this.createError(path, 'pattern', 'must match pattern', { pattern }));
    }
    if (format !== undefined) {
      const validator = this.formatRegistry.get(format);

      if (validator !== undefined && this.dialectPlan.formatAssertions && !validator(value)) {
        errors.push(this.createError(path, 'format', `must match format "${format}"`, { format }));
      }
    }

    return errors;
  }

  private visit(
    node: SchemaGraphNodeInterface,
    graph: SchemaGraphInterface,
    value: unknown,
    path: string,
    options: Pick<GraphEngineOptionsInterface, 'lookupSchema'> & Required<Omit<GraphEngineOptionsInterface, 'formatRegistry' | 'keywords' | 'lookupSchema'>>,
    refStack: Set<string>,
    dynamicScope: DynamicScopeEntryInterface[]
  ): InternalExecutionResultInterface {
    if (typeof node.schema === 'boolean') {
      return node.schema
        ? {
          'errors': [],
          'evaluatedItems': new Set(),
          'evaluatedProperties': new Set(),
          'valid': true,
          value
        }
        : {
          'errors': [this.createError(path, 'falseSchema', 'must not match false schema')],
          'evaluatedItems': new Set(),
          'evaluatedProperties': new Set(),
          'valid': false,
          value
        };
    }

    let workingValue = value;

    const sem = graph.semantics(node);
    const {
      dynamicAnchor,
      dynamicRef,
      enumValues,
      ref,
      schemaTypes
    } = sem;
    const constValue = sem.hasConst ? sem.constValue : undefined;
    const defaultValue = sem.hasDefault ? sem.defaultValue : undefined;

    if (workingValue === undefined && options.applyDefaults && defaultValue !== undefined) {
      workingValue = cloneDefault(defaultValue);
    }
    if (workingValue === undefined && options.synthesizeDefaults) {
      workingValue = this.synthesizeZeroValue(node, graph, options, refStack, dynamicScope);
    }
    if (options.coerce) {
      workingValue = this.coerceValue(schemaTypes, workingValue, options.materializeContainers);
    }

    const nextDynamicScope = typeof dynamicAnchor === 'string'
      ? [
        ...dynamicScope,
        {
          'anchor': dynamicAnchor,
          graph,
          node
        }
      ]
      : dynamicScope;

    if (typeof ref === 'string') {
      const refKey = `${this.schemaId(graph.rootSchema) ?? '<anonymous>'}::${ref}`;

      if (refStack.has(refKey)) {
        return {
          'errors': [],
          'evaluatedItems': new Set(),
          'evaluatedProperties': new Set(),
          'valid': true,
          'value': workingValue
        };
      }
      refStack.add(refKey);
      const resolved = this.resolveRef(ref, graph);
      const resolvedResult = this.visit(
        resolved.node,
        resolved.graph,
        workingValue,
        path,
        options,
        refStack,
        nextDynamicScope
      );

      refStack.delete(refKey);
      if (!resolvedResult.valid) {
        return resolvedResult;
      }
      workingValue = resolvedResult.value;
    }

    if (typeof dynamicRef === 'string') {
      const refKey = `${this.schemaId(graph.rootSchema) ?? '<anonymous>'}::dynamic::${dynamicRef}`;

      if (refStack.has(refKey)) {
        return {
          'errors': [],
          'evaluatedItems': new Set(),
          'evaluatedProperties': new Set(),
          'valid': true,
          'value': workingValue
        };
      }
      refStack.add(refKey);
      const resolved = this.resolveDynamicRef(dynamicRef, graph, nextDynamicScope);
      const resolvedResult = this.visit(
        resolved.node,
        resolved.graph,
        workingValue,
        path,
        options,
        refStack,
        nextDynamicScope
      );

      refStack.delete(refKey);
      if (!resolvedResult.valid) {
        return resolvedResult;
      }
      workingValue = resolvedResult.value;
    }

    const errors: ValidationErrorType[] = [];
    const evaluatedProperties = new Set<string>();
    const evaluatedItems = new Set<number>();

    const pushErrors = (nextErrors: ValidationErrorType[]): void => {
      if (nextErrors.length === 0) {
        return;
      }
      if (options.collectErrors) {
        errors.push(...nextErrors);
      }
    };

    const invalid = (error: ValidationErrorType): InternalExecutionResultInterface => {
      if (options.collectErrors) {
        errors.push(error);
      }

      return {
        errors,
        evaluatedItems,
        evaluatedProperties,
        'valid': false,
        'value': workingValue
      };
    };

    if (schemaTypes.length > 0 && !this.matchesType(schemaTypes, workingValue)) {
      return invalid(this.createError(
        path,
        'type',
        schemaTypes.length === 1 ? `must be ${schemaTypes[0]}` : `must be one of: ${schemaTypes.join(', ')}`,
        { 'type': schemaTypes }
      ));
    }

    if (enumValues !== undefined && !enumValues.some((enumValue) => {
      return deepEqual(enumValue, workingValue);
    })) {
      return invalid(this.createError(path, 'enum', 'must be one of the allowed values'));
    }

    if (constValue !== undefined && !deepEqual(constValue, workingValue)) {
      return invalid(this.createError(path, 'const', `must be ${JSON.stringify(constValue)}`));
    }

    if (typeof workingValue === 'string') {
      const stringErrors = this.validateString(path, workingValue, sem);

      if (stringErrors.length > 0) {
        pushErrors(stringErrors);
        if (!options.collectErrors) {
          return {
            errors,
            evaluatedItems,
            evaluatedProperties,
            'valid': false,
            'value': workingValue
          };
        }
      }
    }

    if (typeof workingValue === 'number') {
      const numberErrors = this.validateNumber(path, workingValue, sem);

      if (numberErrors.length > 0) {
        pushErrors(numberErrors);
        if (!options.collectErrors) {
          return {
            errors,
            evaluatedItems,
            evaluatedProperties,
            'valid': false,
            'value': workingValue
          };
        }
      }
    }

    if (Array.isArray(workingValue)) {
      const arrayResult = this.validateArray(graph, workingValue, path, options, refStack, nextDynamicScope, sem);

      if (!arrayResult.valid && !options.collectErrors) {
        return arrayResult;
      }
      workingValue = arrayResult.value;
      pushErrors(arrayResult.errors);
      for (const index of arrayResult.evaluatedItems) {
        evaluatedItems.add(index);
      }
    }

    if (isObject(workingValue)) {
      const objectResult = this.validateObject(node, graph, workingValue, path, options, refStack, nextDynamicScope);

      if (!objectResult.valid && !options.collectErrors) {
        return objectResult;
      }
      workingValue = objectResult.value;
      pushErrors(objectResult.errors);
      for (const key of objectResult.evaluatedProperties) {
        evaluatedProperties.add(key);
      }
    }

    if (sem.allOf.length > 0) {
      for (const childNode of sem.allOf) {
        const branch = this.visit(childNode, graph, workingValue, path, options, refStack, nextDynamicScope);

        if (!branch.valid && !options.collectErrors) {
          return branch;
        }
        pushErrors(branch.errors);
        workingValue = branch.value;
        for (const key of branch.evaluatedProperties) {
          evaluatedProperties.add(key);
        }
        for (const index of branch.evaluatedItems) {
          evaluatedItems.add(index);
        }
      }
    }

    if (sem.anyOf.length > 0) {
      const successfulResults: InternalExecutionResultInterface[] = [];

      for (const childNode of sem.anyOf) {
        const candidate = this.visit(childNode, graph, cloneCandidate(workingValue), path, {
          ...options,
          'collectErrors': true
        }, refStack, nextDynamicScope);

        if (candidate.valid) {
          successfulResults.push(candidate);
        }
      }

      if (successfulResults.length === 0) {
        return invalid(this.createError(path, 'anyOf', 'must match at least one schema'));
      }

      const matchedResult = successfulResults[0];

      if (matchedResult !== undefined) {
        workingValue = matchedResult.value;
        for (const successful of successfulResults) {
          for (const key of successful.evaluatedProperties) {
            evaluatedProperties.add(key);
          }
          for (const index of successful.evaluatedItems) {
            evaluatedItems.add(index);
          }
        }
      }
    }

    if (sem.oneOf.length > 0) {
      let matches = 0;
      let matchedResult: InternalExecutionResultInterface | undefined;

      // Discriminator optimization: if the schema has a discriminator property,
      // check the discriminator value first and only validate against the matching variant.
      const discProp = sem.discriminatorPropertyName;
      let discriminatorHandled = false;

      if (
        discProp !== undefined
        && typeof workingValue === 'object'
        && workingValue !== null
        && !Array.isArray(workingValue)
      ) {
        const dataObj = workingValue as Record<string, unknown>;
        const discValue = dataObj[discProp];

        if (discValue !== undefined && typeof discValue === 'string') {
          // Pre-cache variant semantics to avoid redundant WeakMap lookups
          const variantCache = sem.oneOf.map((child) => {
            return {
              'node': child,
              'sem': graph.semantics(child)
            };
          });

          // Mapping-based dispatch: discriminator.mapping maps discriminator values to $ref targets.
          const mapping = sem.discriminatorMapping;

          if (mapping !== undefined && discValue in mapping) {
            const targetRef = mapping[discValue];

            for (const variant of variantCache) {
              if (variant.sem.ref === targetRef) {
                const candidate = this.visit(variant.node, graph, cloneCandidate(workingValue), path, {
                  ...options,
                  'collectErrors': true
                }, refStack, nextDynamicScope);

                if (candidate.valid) {
                  matches = 1;
                  matchedResult = candidate;
                }
                discriminatorHandled = true;
                break;
              }
            }
          }

          // Const-based dispatch: find the variant whose discriminator property has a matching const value.
          if (!discriminatorHandled) {
            for (const variant of variantCache) {
              const discPropNode = variant.sem.properties.get(discProp);

              if (discPropNode !== undefined) {
                const discPropSemantics = graph.semantics(discPropNode);

                if (discPropSemantics.hasConst && discPropSemantics.constValue === discValue) {
                  const candidate = this.visit(variant.node, graph, cloneCandidate(workingValue), path, {
                    ...options,
                    'collectErrors': true
                  }, refStack, nextDynamicScope);

                  if (candidate.valid) {
                    matches = 1;
                    matchedResult = candidate;
                  }
                  discriminatorHandled = true;
                  break;
                }
              }
            }
          }
        }
      }

      if (!discriminatorHandled) {
        for (const oneOfChild of sem.oneOf) {
          const candidate = this.visit(oneOfChild, graph, cloneCandidate(workingValue), path, {
            ...options,
            'collectErrors': true
          }, refStack, nextDynamicScope);

          if (candidate.valid) {
            matches++;
            matchedResult = candidate;
          }
        }
      }

      if (matches !== 1) {
        return invalid(this.createError(path, 'oneOf', 'must match exactly one schema'));
      }
      if (matchedResult !== undefined) {
        workingValue = matchedResult.value;
        for (const key of matchedResult.evaluatedProperties) {
          evaluatedProperties.add(key);
        }
        for (const index of matchedResult.evaluatedItems) {
          evaluatedItems.add(index);
        }
      }
    }

    const notNode = sem.notNode;

    if (notNode !== undefined) {
      const notResult = this.visit(notNode, graph, cloneCandidate(workingValue), path, {
        ...options,
        'collectErrors': true
      }, refStack, nextDynamicScope);

      if (notResult.valid) {
        return invalid(this.createError(path, 'not', 'must not match schema'));
      }
    }

    const ifNode = sem.ifNode;

    if (ifNode !== undefined) {
      const condition = this.visit(ifNode, graph, cloneCandidate(workingValue), path, {
        ...options,
        'collectErrors': true
      }, refStack, nextDynamicScope);
      const branchNode = condition.valid ? sem.thenNode : sem.elseNode;

      // Properties evaluated by the if condition count as evaluated (JSON Schema 2020-12 §10.2.2.1)
      for (const key of condition.evaluatedProperties) {
        evaluatedProperties.add(key);
      }
      for (const index of condition.evaluatedItems) {
        evaluatedItems.add(index);
      }

      if (branchNode !== undefined) {
        const branch = this.visit(branchNode, graph, workingValue, path, options, refStack, nextDynamicScope);

        if (!branch.valid && !options.collectErrors) {
          return branch;
        }
        pushErrors(branch.errors);
        workingValue = branch.value;
        for (const key of branch.evaluatedProperties) {
          evaluatedProperties.add(key);
        }
        for (const index of branch.evaluatedItems) {
          evaluatedItems.add(index);
        }
      }
    }

    if (Array.isArray(workingValue) && sem.unevaluatedItemsNode !== undefined) {
      const unevaluatedResult = this.applyUnevaluatedItems(
        node,
        graph,
        workingValue,
        path,
        options,
        refStack,
        nextDynamicScope,
        evaluatedItems
      );

      if (!unevaluatedResult.valid && !options.collectErrors) {
        return unevaluatedResult;
      }
      workingValue = unevaluatedResult.value;
      pushErrors(unevaluatedResult.errors);
      for (const index of unevaluatedResult.evaluatedItems) {
        evaluatedItems.add(index);
      }
    }

    if (isObject(workingValue) && sem.unevaluatedPropertiesNode !== undefined) {
      const unevaluatedResult = this.applyUnevaluatedProperties(
        node,
        graph,
        workingValue,
        path,
        options,
        refStack,
        nextDynamicScope,
        evaluatedProperties
      );

      if (!unevaluatedResult.valid && !options.collectErrors) {
        return unevaluatedResult;
      }
      workingValue = unevaluatedResult.value;
      pushErrors(unevaluatedResult.errors);
      for (const key of unevaluatedResult.evaluatedProperties) {
        evaluatedProperties.add(key);
      }
    }

    // Custom keywords read from graph-owned extensions, not raw schema objects.
    if (this.customKeywords.length > 0) {
      const dataType = inferType(workingValue);

      for (const kw of this.customKeywords) {
        if (!(kw.keyword in sem.extensions)) {
          continue;
        }
        if (kw.type !== undefined) {
          const allowedTypes = Array.isArray(kw.type) ? kw.type : [kw.type];

          if (!allowedTypes.includes(dataType)) {
            continue;
          }
        }
        const kwContext: KeywordContextInterface = {
          'parentData': undefined,
          'parentKey': '',
          'path': path,
          'rootData': workingValue
        };
        const kwResult = kw.validate(
          sem.extensions[kw.keyword],
          workingValue,
          kwContext
        );

        if (kwResult === false) {
          const kwError = this.createError(path, kw.keyword, `must pass "${kw.keyword}" validation`);

          if (options.collectErrors) {
            errors.push(kwError);
          } else {
            return {
              'errors': [kwError],
              evaluatedItems,
              evaluatedProperties,
              'valid': false,
              'value': workingValue
            };
          }
        } else if (Array.isArray(kwResult) && kwResult.length > 0) {
          if (options.collectErrors) {
            errors.push(...kwResult);
          } else {
            return {
              'errors': kwResult,
              evaluatedItems,
              evaluatedProperties,
              'valid': false,
              'value': workingValue
            };
          }
        }
      }
    }

    // rdfs:range validation — enforce range schema on object/array values
    const rdfsRange = sem.rdfsRange;

    if (typeof rdfsRange === 'string' && options.lookupSchema !== undefined) {
      const rangeSchema = options.lookupSchema(rdfsRange);

      if (rangeSchema !== undefined) {
        const rangeRefKey = `rdfs:range::${rdfsRange}`;

        if (!refStack.has(rangeRefKey)) {
          refStack.add(rangeRefKey);

          if (isObject(workingValue)) {
            const rangeGraph = this.graphFor(rangeSchema);
            const rangeResult = this.visit(rangeGraph.rootNode, rangeGraph, workingValue, path, options, refStack, []);

            if (!rangeResult.valid) {
              pushErrors(rangeResult.errors);
            }
          } else if (Array.isArray(workingValue)) {
            const rangeGraph = this.graphFor(rangeSchema);

            for (const [
              i,
              item
            ] of workingValue.entries()) {
              if (isObject(item) || Array.isArray(item)) {
                const itemPath = `${path}/${i}`;
                const itemResult = this.visit(rangeGraph.rootNode, rangeGraph, item, itemPath, options, refStack, []);

                if (!itemResult.valid) {
                  pushErrors(itemResult.errors);
                }
              }
            }
          }

          refStack.delete(rangeRefKey);
        }
      }
    }

    return {
      errors,
      evaluatedItems,
      evaluatedProperties,
      'valid': errors.length === 0,
      'value': workingValue
    };
  }
}

function cloneCandidate<T>(value: T): T {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === 'object') {
    return structuredClone(value);
  }

  return value;
}
