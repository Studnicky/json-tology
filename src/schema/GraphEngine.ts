import type { ValidationError } from '../interfaces/validation.js';
import { type FormatRegistry, builtinFormats } from './FormatRegistry.js';
import { SchemaGraph, type SchemaGraphNode } from './SchemaGraph.js';

type JsonSchema = boolean | Record<string, unknown>;

export interface KeywordContext {
  'parentData': unknown;
  'parentKey': number | string;
  'path': string;
  'rootData': unknown;
}

export interface KeywordDefinition {
  'keyword': string;
  'type'?: string | string[];
  'validate': (schema: unknown, data: unknown, context: KeywordContext) => boolean | ValidationError[];
}

export interface GraphEngineOptions {
  'applyDefaults'?: boolean;
  'coerce'?: boolean;
  'collectErrors'?: boolean;
  'formatRegistry'?: FormatRegistry;
  'ignoreAdditionalProperties'?: boolean;
  'keywords'?: KeywordDefinition[];
  'lookupSchema'?: (schemaId: string) => Record<string, unknown> | undefined;
  'materializeContainers'?: boolean;
  'removeAdditional'?: boolean;
  'stripUnknownProperties'?: boolean;
}

interface InternalExecutionResult {
  'errors': ValidationError[];
  'evaluatedItems': Set<number>;
  'evaluatedProperties': Set<string>;
  'valid': boolean;
  'value': unknown;
}

export interface GraphExecutionResult {
  'entryNode': SchemaGraphNode;
  'errors': ValidationError[];
  'evaluatedItems': Set<number>;
  'evaluatedProperties': Set<string>;
  'graph': SchemaGraph;
  'valid': boolean;
  'value': unknown;
}

interface RefTarget {
  'rootSchema': JsonSchema;
  'schema': JsonSchema;
}

interface DynamicScopeEntry {
  'anchor': string;
  'rootSchema': JsonSchema;
  'schema': JsonSchema;
}

interface ObjectValidationPlan {
  'dependentRequired': Record<string, string[]>;
  'dependentSchemaEntries': Array<[string, JsonSchema]>;
  'patternPropertyEntries': Array<{
    'pattern': string;
    'regex': RegExp;
    'schema': JsonSchema;
  }>;
  'propertyEntries': Array<[string, JsonSchema]>;
  'propertySchemaMap': Map<string, JsonSchema>;
  'required': string[];
}

interface SchemaNodePlan {
  'additionalProperties': JsonSchema | boolean | undefined;
  'allOf': JsonSchema[];
  'anyOf': JsonSchema[];
  'constValue': unknown;
  'containsSchema': JsonSchema | undefined;
  'defaultValue': unknown;
  'dynamicAnchor': string | undefined;
  'dynamicRef': string | undefined;
  'enumValues': unknown[] | undefined;
  'exclusiveMaximum': number | undefined;
  'exclusiveMinimum': number | undefined;
  'format': string | undefined;
  'ifSchema': JsonSchema | undefined;
  'itemsSchema': JsonSchema | undefined;
  'maxContains': number | undefined;
  'maxItems': number | undefined;
  'maxLength': number | undefined;
  'maxProperties': number | undefined;
  'maximum': number | undefined;
  'minContains': number | undefined;
  'minItems': number | undefined;
  'minLength': number | undefined;
  'minProperties': number | undefined;
  'minimum': number | undefined;
  'multipleOf': number | undefined;
  'notSchema': JsonSchema | undefined;
  'oneOf': JsonSchema[];
  'pattern': string | undefined;
  'prefixItems': JsonSchema[] | undefined;
  'propertyNamesSchema': JsonSchema | undefined;
  'ref': string | undefined;
  'schemaTypes': string[];
  'thenSchema': JsonSchema | undefined;
  'tupleItems': undefined;
  'unevaluatedItems': JsonSchema | boolean | undefined;
  'unevaluatedProperties': JsonSchema | boolean | undefined;
  'uniqueItems': boolean;
  'discriminatorPropertyName': string | undefined;
  'elseSchema': JsonSchema | undefined;
}

interface RootDialectPlan {
  'formatAssertions': boolean;
}

const DEFAULT_OPTIONS: Required<Omit<GraphEngineOptions, 'formatRegistry' | 'keywords' | 'lookupSchema'>> = {
  'applyDefaults': false,
  'coerce': false,
  'collectErrors': true,
  'ignoreAdditionalProperties': false,
  'materializeContainers': false,
  'removeAdditional': false,
  'stripUnknownProperties': false
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

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isInteger(value: unknown): boolean {
  return typeof value === 'number' && Number.isInteger(value);
}

function isJsonSchema(value: unknown): value is JsonSchema {
  return typeof value === 'boolean' || isObject(value);
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

function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

export function keySortReplacer(_key: string, value: unknown): unknown {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const sorted: Record<string, unknown> = {};

    for (const key of Object.keys(value).sort()) {
      sorted[key] = (value as Record<string, unknown>)[key];
    }

    return sorted;
  }

  return value;
}

export function deterministicHash(value: unknown): string {
  const serialized = JSON.stringify(value, keySortReplacer);
  let hash = 2_166_136_261;
  const fnvPrime = 16_777_619;

  for (let i = 0; i < serialized.length; i++) {
    hash ^= serialized.codePointAt(i) ?? 0;
    hash = (hash * fnvPrime) >>> 0;
  }

  return hash.toString(16);
}


function keywordValue<T>(
  graph: SchemaGraph | undefined,
  node: unknown,
  schema: Record<string, unknown>,
  key: string
): T | undefined {
  if (graph !== undefined && node !== undefined) {
    const direct = graph.keywordValue(node as never, key) as T | undefined;

    if (direct !== undefined) {
      return direct;
    }

    return undefined;
  }

  const direct = schema[key] as T | undefined;

  if (direct !== undefined) {
    return direct;
  }

  return undefined;
}

function childSchema(
  graph: SchemaGraph | undefined,
  node: unknown,
  schema: Record<string, unknown>,
  key: string
): JsonSchema | undefined {
  if (graph !== undefined && node !== undefined) {
    const direct = graph.child(node as never, key)?.schema;

    if (direct !== undefined) {
      return direct;
    }

    return undefined;
  }

  const value = schema[key];

  return isJsonSchema(value) ? value : undefined;
}

function indexedSchemaChildren(
  graph: SchemaGraph | undefined,
  node: unknown,
  schema: Record<string, unknown>,
  key: string
): JsonSchema[] {
  if (graph !== undefined && node !== undefined) {
    return Array.isArray(graph.keywordValue(node as never, key))
      ? graph.indexedChildren(node as never, key).map((child) => child.schema)
      : [];
  }

  const value = schema[key];

  return Array.isArray(value) ? value.filter((entry) => isJsonSchema(entry)) : [];
}

function schemaEntries(
  graph: SchemaGraph | undefined,
  node: unknown,
  schema: Record<string, unknown>,
  key: string
): Array<[string, JsonSchema]> {
  if (graph !== undefined && node !== undefined) {
    const direct = graph.entries(node as never, key).map(([entryKey, child]) => [entryKey, child.schema] as [string, JsonSchema]);

    if (direct.length > 0) {
      return direct;
    }

    return [];
  }

  const candidate = schema[key];

  return Object.entries(isObject(candidate) ? candidate : {}).filter(([, entry]) => isJsonSchema(entry)) as Array<[string, JsonSchema]>;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function escapeInstanceSegment(value: string): string {
  return encodeURIComponent(value).replaceAll('%2F', '/');
}

export function propertyIri(classId: string, propertyName: string): string {
  return `${classId}#${propertyName}`;
}

export class GraphEngine {
  private readonly customKeywords: KeywordDefinition[];
  private readonly dialectPlan: RootDialectPlan;
  public readonly formatRegistry: FormatRegistry;
  private readonly graphCache = new WeakMap<object, SchemaGraph>();
  private readonly nodePlanCache = new WeakMap<object, SchemaNodePlan>();
  private readonly objectPlanCache = new WeakMap<object, ObjectValidationPlan>();
  private readonly options: Required<Omit<GraphEngineOptions, 'formatRegistry' | 'keywords' | 'lookupSchema'>> & Pick<GraphEngineOptions, 'lookupSchema'>;
  private readonly refCache = new Map<string, RefTarget>();
  private readonly regexCache = new Map<string, RegExp>();

  public constructor(public readonly rootSchema: JsonSchema, options: GraphEngineOptions = {}) {
    const { formatRegistry, keywords, ...rest } = options;
    this.formatRegistry = formatRegistry ?? builtinFormats();
    this.customKeywords = keywords ?? [];
    this.options = {
      ...DEFAULT_OPTIONS,
      ...rest
    };
    this.dialectPlan = this.rootDialectPlan(rootSchema);
  }

  public hasCustomKeywords(): boolean {
    return this.customKeywords.length > 0;
  }

  public schemaLookup(): ((schemaId: string) => Record<string, unknown> | undefined) | undefined {
    return this.options.lookupSchema;
  }

  public check(value: unknown, pointer = ''): boolean {
    return this.execute(value, pointer, { 'collectErrors': false }).valid;
  }

  public errors(value: unknown, pointer = ''): ValidationError[] {
    return this.execute(value, pointer, { 'collectErrors': true }).errors;
  }

  public execute(
    value: unknown,
    pointer = '',
    overrides: Partial<Omit<GraphEngineOptions, 'formatRegistry' | 'lookupSchema'>> = {}
  ): GraphExecutionResult {
    const graph = this.graphFor(this.rootSchema);
    const entryNode = graph.resolvePointer(pointer);
    const schema = entryNode.schema;
    const effective = {
      ...this.options,
      ...overrides
    };

    const result = this.visit(schema, this.rootSchema, value, '', effective, new Set(), []);

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


  public fillImplicitProperties(
    graph: SchemaGraph,
    node: SchemaGraphNode,
    value: unknown,
    currentRoot: JsonSchema = this.rootSchema
  ): void {
    const targetNode = this.resolveGraphTargetNode(graph, node, currentRoot);

    if (!isRecord(value)) {
      return;
    }

    for (const [propertyName, propertyNode] of graph.semantics(targetNode).properties) {
      if (!(propertyName in value)) {
        value[propertyName] = undefined;
        continue;
      }

      const propertyValue = value[propertyName];
      const propertyTargetNode = this.resolveGraphTargetNode(graph, propertyNode, currentRoot);

      if (Array.isArray(propertyValue)) {
        const itemsNode = graph.semantics(propertyTargetNode).itemsNode;

        if (itemsNode === undefined) {
          continue;
        }

        for (const item of propertyValue) {
          this.fillImplicitProperties(graph, itemsNode, item, currentRoot);
        }

        continue;
      }

      this.fillImplicitProperties(graph, propertyTargetNode, propertyValue, currentRoot);
    }
  }

  public projectNode(
    graph: SchemaGraph,
    schemaNode: SchemaGraphNode,
    value: unknown,
    subjectId: string,
    nodes: Array<Record<string, unknown>>,
    path: string,
    currentRoot: JsonSchema
  ): void {
    const targetNode = this.resolveGraphTargetNode(graph, schemaNode, currentRoot);

    if (!isRecord(value)) {
      return;
    }

    const node: Record<string, unknown> = {
      '@id': subjectId,
      '@type': { '@id': targetNode.id }
    };

    for (const [propertyName, propertySchemaNode] of graph.semantics(targetNode).properties) {
      if (!(propertyName in value)) {
        continue;
      }

      const propertyValue = value[propertyName];
      const propertyId = propertyIri(targetNode.id, propertyName);
      const childPath = path === '' ? propertyName : `${path}/${propertyName}`;

      if (Array.isArray(propertyValue)) {
        const propertyTargetNode = this.resolveGraphTargetNode(graph, propertySchemaNode, currentRoot);
        const itemsNode = graph.semantics(propertyTargetNode).itemsNode;

        if (itemsNode === undefined) {
          node[propertyId] = propertyValue;
          continue;
        }

        node[propertyId] = propertyValue.map((itemValue, index) => {
          return this.projectPropertyValue(
            graph,
            itemsNode,
            itemValue,
            `${subjectId}#/${childPath}/${index}`,
            nodes,
            `${childPath}/${index}`,
            currentRoot
          );
        });
        continue;
      }

      node[propertyId] = this.projectPropertyValue(
        graph,
        propertySchemaNode,
        propertyValue,
        `${subjectId}#/${childPath}`,
        nodes,
        childPath,
        currentRoot
      );
    }

    nodes.push(node);
  }

  public projectPropertyValue(
    graph: SchemaGraph,
    schemaNode: SchemaGraphNode,
    value: unknown,
    subjectId: string,
    nodes: Array<Record<string, unknown>>,
    path: string,
    currentRoot: JsonSchema
  ): unknown {
    const targetNode = this.resolveGraphTargetNode(graph, schemaNode, currentRoot);
    const targetSchema = targetNode.schema;

    if (!isRecord(value) || !isObject(targetSchema)) {
      return value;
    }

    const semantics = graph.semantics(targetNode);

    if (semantics.properties.length === 0 && targetSchema.type !== 'object') {
      return value;
    }

    this.projectNode(graph, targetNode, value, subjectId, nodes, path, currentRoot);

    return { '@id': subjectId };
  }

  public resolveGraphTargetNode(
    graph: SchemaGraph,
    schemaNode: SchemaGraphNode,
    currentRoot: JsonSchema
  ): SchemaGraphNode {
    const semantics = graph.semantics(schemaNode);

    if (semantics.ref === undefined) {
      return schemaNode;
    }

    const resolved = this.resolveRef(semantics.ref, currentRoot);

    if (!isObject(resolved.rootSchema) || !isObject(resolved.schema)) {
      return schemaNode;
    }

    return this.graphFor(resolved.rootSchema).node(resolved.schema) ?? schemaNode;
  }

  public rootSchemaId(): string | undefined {
    return this.schemaId(this.rootSchema);
  }

  private createError(
    path: string,
    keyword: string,
    message: string,
    params: Record<string, unknown> = {}
  ): ValidationError {
    return {
      keyword,
      message,
      params,
      path
    };
  }

  private resolveRef(ref: string, currentRoot: JsonSchema): RefTarget {
    const currentRootId = this.schemaId(currentRoot);
    const cacheKey = `${currentRootId ?? '<anonymous>'}::${ref}`;
    const cached = this.refCache.get(cacheKey);

    if (cached !== undefined) {
      return cached;
    }

    let rootSchema = currentRoot;
    let fragment = '';

    if (ref.startsWith('#')) {
      fragment = ref.slice(1);
    } else {
      const hashIndex = ref.indexOf('#');
      const schemaId = hashIndex === -1 ? ref : ref.slice(0, hashIndex);
      fragment = hashIndex === -1 ? '' : ref.slice(hashIndex + 1);

      const lookedUp = this.options.lookupSchema?.(schemaId);

      if (lookedUp === undefined) {
        throw new Error(`Unresolved schema reference: ${ref}`);
      }
      rootSchema = lookedUp;
    }

    const schema = this.resolveFragment(rootSchema, fragment);
    const target = {
      rootSchema,
      schema
    };

    this.refCache.set(cacheKey, target);

    return target;
  }

  private resolveDynamicRef(
    ref: string,
    currentRoot: JsonSchema,
    dynamicScope: DynamicScopeEntry[]
  ): RefTarget {
    if (ref === '#') {
      for (let index = dynamicScope.length - 1; index >= 0; index--) {
        if (dynamicScope[index].anchor === '') {
          return {
            'rootSchema': dynamicScope[index].rootSchema,
            'schema': dynamicScope[index].schema
          };
        }
      }
    }

    const resolved = this.resolveRef(ref, currentRoot);
    const fragment = this.extractNamedFragment(ref);
    const resolvedAnchor = isObject(resolved.schema)
      ? (typeof resolved.schema.$dynamicAnchor === 'string'
        ? resolved.schema.$dynamicAnchor
        : resolved.schema.$recursiveAnchor === true
          ? ''
          : undefined)
      : undefined;

    if (fragment === undefined || resolvedAnchor !== fragment) {
      return resolved;
    }

    for (const entry of dynamicScope) {
      if (entry.anchor === fragment) {
        return {
          'rootSchema': entry.rootSchema,
          'schema': entry.schema
        };
      }
    }

    return resolved;
  }

  private schemaId(schema: JsonSchema): string | undefined {
    if (!isObject(schema)) {
      return undefined;
    }
    return typeof schema.$id === 'string' ? schema.$id : undefined;
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

  private resolveFragment(rootSchema: JsonSchema, fragment: string): JsonSchema {
    if (!isObject(rootSchema)) {
      if (fragment === '') {
        return rootSchema;
      }
      throw new Error(`Cannot resolve fragment on boolean schema: #${fragment}`);
    }

    return this.graphFor(rootSchema).resolveFragment(fragment).schema;
  }

  private graphFor(rootSchema: JsonSchema): SchemaGraph {
    if (!isObject(rootSchema)) {
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

  private visit(
    schema: JsonSchema,
    currentRoot: JsonSchema,
    value: unknown,
    path: string,
    options: Required<Omit<GraphEngineOptions, 'formatRegistry' | 'keywords' | 'lookupSchema'>> & Pick<GraphEngineOptions, 'lookupSchema'>,
    refStack: Set<string>,
    dynamicScope: DynamicScopeEntry[]
  ): InternalExecutionResult {
    if (typeof schema === 'boolean') {
      return schema
        ? {
          errors: [],
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

    const graph = isObject(currentRoot) ? this.graphFor(currentRoot) : undefined;
    const currentNode = graph?.node(schema);
    const nodePlan = this.schemaNodePlan(schema, graph, currentNode);
    const {
      constValue,
      defaultValue,
      dynamicAnchor,
      dynamicRef,
      enumValues,
      ref,
      schemaTypes
    } = nodePlan;

    if (workingValue === undefined && options.applyDefaults && defaultValue !== undefined) {
      workingValue = cloneDefault(defaultValue);
    }
    if (options.coerce) {
      workingValue = this.coerceValue(schemaTypes, workingValue, options.materializeContainers);
    }

    const nextDynamicScope = typeof dynamicAnchor === 'string'
      ? [
        ...dynamicScope,
        {
          'anchor': dynamicAnchor,
          'rootSchema': currentRoot,
          schema
        }
      ]
      : dynamicScope;

    if (typeof ref === 'string') {
      const refKey = `${this.schemaId(currentRoot) ?? '<anonymous>'}::${ref}`;

      if (refStack.has(refKey)) {
        return {
          errors: [],
          'evaluatedItems': new Set(),
          'evaluatedProperties': new Set(),
          'valid': true,
          'value': workingValue
        };
      }
      refStack.add(refKey);
      const resolved = this.resolveRef(ref, currentRoot);
      const resolvedResult = this.visit(
        resolved.schema,
        resolved.rootSchema,
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
      const refKey = `${this.schemaId(currentRoot) ?? '<anonymous>'}::dynamic::${dynamicRef}`;

      if (refStack.has(refKey)) {
        return {
          errors: [],
          'evaluatedItems': new Set(),
          'evaluatedProperties': new Set(),
          'valid': true,
          'value': workingValue
        };
      }
      refStack.add(refKey);
      const resolved = this.resolveDynamicRef(dynamicRef, currentRoot, nextDynamicScope);
      const resolvedResult = this.visit(
        resolved.schema,
        resolved.rootSchema,
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

    const errors: ValidationError[] = [];
    const evaluatedProperties = new Set<string>();
    const evaluatedItems = new Set<number>();

    const pushErrors = (nextErrors: ValidationError[]): void => {
      if (nextErrors.length === 0) {
        return;
      }
      if (options.collectErrors) {
        errors.push(...nextErrors);
      }
    };

    const invalid = (error: ValidationError): InternalExecutionResult => {
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
      return invalid(
        this.createError(
          path,
          'type',
          schemaTypes.length === 1 ? `must be ${schemaTypes[0]}` : `must be one of: ${schemaTypes.join(', ')}`,
          { 'type': schemaTypes }
        )
      );
    }

    if (enumValues !== undefined) {
      if (!enumValues.some((enumValue) => {
        return deepEqual(enumValue, workingValue);
      })) {
        return invalid(this.createError(path, 'enum', 'must be one of the allowed values'));
      }
    }

    if (constValue !== undefined && !deepEqual(constValue, workingValue)) {
      return invalid(this.createError(path, 'const', `must be ${JSON.stringify(constValue)}`));
    }

    if (typeof workingValue === 'string') {
      const stringErrors = this.validateString(path, workingValue, nodePlan);

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
      const numberErrors = this.validateNumber(path, workingValue, nodePlan);

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
      const arrayResult = this.validateArray(currentRoot, workingValue, path, options, refStack, nextDynamicScope, nodePlan);

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
      const objectResult = this.validateObject(schema, currentRoot, workingValue, path, options, refStack, nextDynamicScope);

      if (!objectResult.valid && !options.collectErrors) {
        return objectResult;
      }
      workingValue = objectResult.value;
      pushErrors(objectResult.errors);
      for (const key of objectResult.evaluatedProperties) {
        evaluatedProperties.add(key);
      }
    }

    const allOfNodes = nodePlan.allOf.map((element) => ({ schema: element }));

    if (allOfNodes.length > 0) {
      for (const element of allOfNodes) {
        const branch = this.visit(element.schema, currentRoot, workingValue, path, options, refStack, nextDynamicScope);

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

    const anyOfNodes = nodePlan.anyOf.map((element) => ({ schema: element }));

    if (anyOfNodes.length > 0) {
      let successfulResults: InternalExecutionResult[] = [];

      for (const element of anyOfNodes) {
        const candidate = this.visit(element.schema, currentRoot, cloneCandidate(workingValue), path, {
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

    const oneOfNodes = nodePlan.oneOf.map((element) => ({ schema: element }));

    if (oneOfNodes.length > 0) {
      let matches = 0;
      let matchedResult: InternalExecutionResult | undefined;

      // Discriminator optimization: if the schema has a discriminator property,
      // check the discriminator value first and only validate against the matching variant.
      const discProp = nodePlan.discriminatorPropertyName;
      let discriminatorHandled = false;

      if (
        discProp !== undefined
        && typeof workingValue === 'object'
        && workingValue !== null
        && !Array.isArray(workingValue)
      ) {
        const dataObj = workingValue as Record<string, unknown>;
        const discValue = dataObj[discProp];

        if (discValue !== undefined) {
          // Find the variant whose discriminator property has a matching const value
          for (const element of oneOfNodes) {
            const variantSchema = element.schema;

            if (typeof variantSchema === 'object' && variantSchema !== null) {
              const variant = variantSchema as Record<string, unknown>;
              const props = variant.properties as Record<string, unknown> | undefined;

              if (props !== undefined && props !== null) {
                const discSchema = props[discProp];

                if (typeof discSchema === 'object' && discSchema !== null) {
                  const discSchemaObj = discSchema as Record<string, unknown>;
                  const constVal = discSchemaObj.const;

                  if (constVal !== undefined && constVal === discValue) {
                    const candidate = this.visit(element.schema, currentRoot, cloneCandidate(workingValue), path, {
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
      }

      if (!discriminatorHandled) {
        for (const element of oneOfNodes) {
          const candidate = this.visit(element.schema, currentRoot, cloneCandidate(workingValue), path, {
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

    const notSchema = nodePlan.notSchema;

    if (notSchema !== undefined) {
      const notResult = this.visit(notSchema, currentRoot, cloneCandidate(workingValue), path, {
        ...options,
        'collectErrors': true
      }, refStack, nextDynamicScope);

      if (notResult.valid) {
        return invalid(this.createError(path, 'not', 'must not match schema'));
      }
    }

    const ifSchema = nodePlan.ifSchema;

    if (ifSchema !== undefined) {
      const condition = this.visit(ifSchema, currentRoot, cloneCandidate(workingValue), path, {
        ...options,
        'collectErrors': true
      }, refStack, nextDynamicScope);
      const branchSchema = condition.valid ? nodePlan.thenSchema : nodePlan.elseSchema;

      // Properties evaluated by the if condition count as evaluated (JSON Schema 2020-12 §10.2.2.1)
      for (const key of condition.evaluatedProperties) {
        evaluatedProperties.add(key);
      }
      for (const index of condition.evaluatedItems) {
        evaluatedItems.add(index);
      }

      if (branchSchema !== undefined) {
        const branch = this.visit(branchSchema as JsonSchema, currentRoot, workingValue, path, options, refStack, nextDynamicScope);

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

    if (Array.isArray(workingValue) && nodePlan.unevaluatedItems !== undefined) {
      const unevaluatedResult = this.applyUnevaluatedItems(
        schema,
        currentRoot,
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

    if (isObject(workingValue) && nodePlan.unevaluatedProperties !== undefined) {
      const unevaluatedResult = this.applyUnevaluatedProperties(
        schema,
        currentRoot,
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

    if (this.customKeywords.length > 0) {
      const dataType = inferType(workingValue);

      for (const kw of this.customKeywords) {
        if (!(kw.keyword in schema)) {
          continue;
        }
        if (kw.type !== undefined) {
          const allowedTypes = Array.isArray(kw.type) ? kw.type : [kw.type];

          if (!allowedTypes.includes(dataType)) {
            continue;
          }
        }
        const kwContext: KeywordContext = {
          'parentData': undefined,
          'parentKey': '',
          'path': path,
          'rootData': workingValue
        };
        const kwResult = kw.validate(
          (schema as Record<string, unknown>)[kw.keyword],
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
    const rdfsRange = typeof schema === 'object' && schema !== null && !Array.isArray(schema)
      ? (schema as Record<string, unknown>)['rdfs:range']
      : undefined;

    if (typeof rdfsRange === 'string' && options.lookupSchema !== undefined) {
      const rangeSchema = options.lookupSchema(rdfsRange);

      if (rangeSchema !== undefined) {
        const rangeRefKey = `rdfs:range::${rdfsRange}`;

        if (!refStack.has(rangeRefKey)) {
          refStack.add(rangeRefKey);

          if (isObject(workingValue)) {
            const rangeResult = this.visit(
              rangeSchema, rangeSchema, workingValue, path, options, refStack, []
            );

            if (!rangeResult.valid) {
              pushErrors(rangeResult.errors);
            }
          } else if (Array.isArray(workingValue)) {
            for (let i = 0; i < workingValue.length; i++) {
              const item = workingValue[i];

              if (isObject(item) || Array.isArray(item)) {
                const itemPath = `${path}/${i}`;
                const itemResult = this.visit(
                  rangeSchema, rangeSchema, item, itemPath, options, refStack, []
                );

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

    if (schemaTypes.includes('number') || schemaTypes.includes('integer')) {
      if (typeof value === 'string') {
        const coerced = Number(value);

        if (!Number.isNaN(coerced)) {
          return schemaTypes.includes('integer') ? Math.trunc(coerced) : coerced;
        }
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

  private validateString(
    path: string,
    value: string,
    nodePlan: SchemaNodePlan
  ): ValidationError[] {
    const errors: ValidationError[] = [];
    const {
      format,
      'maxLength': maximum,
      'minLength': minimum,
      pattern
    } = nodePlan;
    const valueLength = Array.from(value).length;

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

  private validateNumber(
    path: string,
    value: number,
    nodePlan: SchemaNodePlan
  ): ValidationError[] {
    const errors: ValidationError[] = [];
    const {
      'exclusiveMaximum': exclusiveMaximum,
      'exclusiveMinimum': exclusiveMinimum,
      format,
      maximum,
      minimum,
      multipleOf
    } = nodePlan;

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

  private validateArray(
    currentRoot: JsonSchema,
    value: unknown[],
    path: string,
    options: Required<Omit<GraphEngineOptions, 'formatRegistry' | 'keywords' | 'lookupSchema'>> & Pick<GraphEngineOptions, 'lookupSchema'>,
    refStack: Set<string>,
    dynamicScope: DynamicScopeEntry[],
    nodePlan: SchemaNodePlan
  ): InternalExecutionResult {
    const errors: ValidationError[] = [];
    const evaluatedItems = new Set<number>();
    let workingValue = value;
    const {
      containsSchema,
      maxContains,
      maxItems,
      minContains,
      minItems,
      itemsSchema,
      prefixItems,
      tupleItems,
      uniqueItems
    } = nodePlan;

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

    const fixedItems = prefixItems ?? tupleItems;

    if (fixedItems !== undefined) {
      for (const [
        index,
        itemSchema
      ] of fixedItems.entries()) {
        if (index >= workingValue.length) {
          break;
        }
        const child = this.visit(itemSchema, currentRoot, workingValue[index], `${path}/${index}`, options, refStack, dynamicScope);

        if (!child.valid && !options.collectErrors) {
          return child;
        }
        workingValue[index] = child.value;
        evaluatedItems.add(index);
        errors.push(...child.errors);
      }

      const extraStart = fixedItems.length;
      if (itemsSchema === false && workingValue.length > extraStart) {
        errors.push(this.createError(path, 'items', 'must NOT have items beyond prefixItems'));
      } else if (itemsSchema !== undefined && itemsSchema !== true && itemsSchema !== false) {
        for (let index = extraStart; index < workingValue.length; index++) {
          const child = this.visit(itemsSchema as JsonSchema, currentRoot, workingValue[index], `${path}/${index}`, options, refStack, dynamicScope);

          if (!child.valid && !options.collectErrors) {
            return child;
          }
          workingValue[index] = child.value;
          evaluatedItems.add(index);
          errors.push(...child.errors);
        }
      }
    } else {
      if (itemsSchema !== undefined) {
      for (let index = 0; index < workingValue.length; index++) {
        const child = this.visit(itemsSchema, currentRoot, workingValue[index], `${path}/${index}`, options, refStack, dynamicScope);

        if (!child.valid && !options.collectErrors) {
          return child;
        }
        workingValue[index] = child.value;
        evaluatedItems.add(index);
        errors.push(...child.errors);
      }
      }
    }

    if (containsSchema !== undefined) {
      let matches = 0;

      for (let index = 0; index < workingValue.length; index++) {
        const candidate = this.visit(containsSchema as JsonSchema, currentRoot, cloneCandidate(workingValue[index]), `${path}/${index}`, {
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

  private validateObject(
    schema: Record<string, unknown>,
    currentRoot: JsonSchema,
    value: Record<string, unknown>,
    path: string,
    options: Required<Omit<GraphEngineOptions, 'formatRegistry' | 'keywords' | 'lookupSchema'>> & Pick<GraphEngineOptions, 'lookupSchema'>,
    refStack: Set<string>,
    dynamicScope: DynamicScopeEntry[]
  ): InternalExecutionResult {
    const errors: ValidationError[] = [];
    const evaluatedProperties = new Set<string>();
    const graph = isObject(currentRoot) ? this.graphFor(currentRoot) : undefined;
    const currentNode = graph?.node(schema);
    const nodePlan = this.schemaNodePlan(schema, graph, currentNode);
    const objectPlan = this.objectValidationPlan(schema, graph, currentNode);
    const propertyEntries = objectPlan.propertyEntries;
    const propertySchemaMap = objectPlan.propertySchemaMap;
    const required = objectPlan.required;
    const patternPropertyEntries = objectPlan.patternPropertyEntries;
    const dependentRequired = objectPlan.dependentRequired;
    const dependentSchemaEntries = objectPlan.dependentSchemaEntries;
    const workingValue = value;
    const {
      maxProperties,
      minProperties,
      propertyNamesSchema
    } = nodePlan;

    if (typeof minProperties === 'number' && Object.keys(workingValue).length < minProperties) {
      errors.push(this.createError(path, 'minProperties', `must NOT have fewer than ${minProperties} properties`, { 'limit': minProperties }));
    }
    if (typeof maxProperties === 'number' && Object.keys(workingValue).length > maxProperties) {
      errors.push(this.createError(path, 'maxProperties', `must NOT have more than ${maxProperties} properties`, { 'limit': maxProperties }));
    }

    if (options.applyDefaults) {
      for (const [
        key,
        propSchema
      ] of propertyEntries) {
        if (key in workingValue) {
          continue;
        }
        const prepared = this.createImplicitDefault(propSchema as JsonSchema, currentRoot, options, refStack, dynamicScope);

        if (prepared !== undefined) {
          workingValue[key] = prepared;
        }
      }
    }

    for (const key of required) {
      if (!(key in workingValue)) {
        const propSchema = propertySchemaMap.get(key);

        if (options.applyDefaults && (propSchema === true || propSchema === false || isObject(propSchema))) {
          const prepared = this.createImplicitDefault(propSchema as JsonSchema, currentRoot, options, refStack, dynamicScope);

          if (prepared !== undefined) {
            workingValue[key] = prepared;
          }
        }
      }
      if (!(key in workingValue)) {
        errors.push(this.createError(path, 'required', `must have required property '${key}'`, { 'missingProperty': key }));
      }
    }

    for (const key of Object.keys(workingValue)) {
      if (propertyNamesSchema !== undefined) {
        const propertyNameResult = this.visit(propertyNamesSchema, currentRoot, key, path, {
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

      if (propertySchemaMap.has(key)) {
        const child = this.visit(propertySchemaMap.get(key) as JsonSchema, currentRoot, workingValue[key], `${path}/${escapeJsonPointer(key)}`, options, refStack, dynamicScope);

        if (!child.valid && !options.collectErrors) {
          return child;
        }
        workingValue[key] = child.value;
        evaluatedProperties.add(key);
        errors.push(...child.errors);
      }

      for (const patternEntry of patternPropertyEntries) {
        if (patternEntry.regex.test(key)) {
          const child = this.visit(patternEntry.schema, currentRoot, workingValue[key], `${path}/${escapeJsonPointer(key)}`, options, refStack, dynamicScope);

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
        dependencySchema
      ] of dependentSchemaEntries) {
        if (!(key in workingValue)) {
          continue;
        }
        const child = this.visit(dependencySchema as JsonSchema, currentRoot, workingValue, path, options, refStack, dynamicScope);

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

      const additionalProperties = nodePlan.additionalProperties;

      if (additionalProperties === false) {
        if (options.removeAdditional) {
          delete workingValue[key];
        } else {
          errors.push(this.createError(`${path}/${escapeJsonPointer(key)}`, 'additionalProperties', 'must NOT have additional properties', {
            'additionalProperty': key
          }));
        }

        return;
      }

      if (additionalProperties === undefined || additionalProperties === true) {
        if (options.stripUnknownProperties) {
          delete workingValue[key];
        }

        return;
      }

      const child = this.visit(additionalProperties as JsonSchema, currentRoot, workingValue[key], `${path}/${escapeJsonPointer(key)}`, options, refStack, dynamicScope);

      if (!child.valid) {
        errors.push(...child.errors);
      } else {
        workingValue[key] = child.value;
        evaluatedProperties.add(key);
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

  private applyUnevaluatedItems(
    schema: Record<string, unknown>,
    currentRoot: JsonSchema,
    value: unknown[],
    path: string,
    options: Required<Omit<GraphEngineOptions, 'formatRegistry' | 'keywords' | 'lookupSchema'>> & Pick<GraphEngineOptions, 'lookupSchema'>,
    refStack: Set<string>,
    dynamicScope: DynamicScopeEntry[],
    alreadyEvaluated: Set<number>
  ): InternalExecutionResult {
    const errors: ValidationError[] = [];
    const evaluatedItems = new Set<number>();
    const workingValue = value;
    const graph = isObject(currentRoot) ? this.graphFor(currentRoot) : undefined;
    const currentNode = graph?.node(schema);
    const nodePlan = this.schemaNodePlan(schema, graph, currentNode);

    for (let index = 0; index < workingValue.length; index++) {
      if (alreadyEvaluated.has(index)) {
        continue;
      }
      const subSchema = nodePlan.unevaluatedItems;

      if (subSchema === false) {
        errors.push(this.createError(`${path}/${index}`, 'unevaluatedItems', 'must NOT have unevaluated items'));
        continue;
      }
      if (subSchema === true) {
        continue;
      }
      const child = this.visit(subSchema as JsonSchema, currentRoot, workingValue[index], `${path}/${index}`, options, refStack, dynamicScope);

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
    schema: Record<string, unknown>,
    currentRoot: JsonSchema,
    value: Record<string, unknown>,
    path: string,
    options: Required<Omit<GraphEngineOptions, 'formatRegistry' | 'keywords' | 'lookupSchema'>> & Pick<GraphEngineOptions, 'lookupSchema'>,
    refStack: Set<string>,
    dynamicScope: DynamicScopeEntry[],
    alreadyEvaluated: Set<string>
  ): InternalExecutionResult {
    const errors: ValidationError[] = [];
    const evaluatedProperties = new Set<string>();
    const workingValue = value;
    const graph = isObject(currentRoot) ? this.graphFor(currentRoot) : undefined;
    const currentNode = graph?.node(schema);
    const nodePlan = this.schemaNodePlan(schema, graph, currentNode);

    for (const key of Object.keys(workingValue)) {
      if (alreadyEvaluated.has(key)) {
        continue;
      }
      const unevaluatedProperties = nodePlan.unevaluatedProperties;

      if (unevaluatedProperties === false) {
        errors.push(this.createError(`${path}/${escapeJsonPointer(key)}`, 'unevaluatedProperties', 'must NOT have unevaluated properties', {
          'unevaluatedProperty': key
        }));
        continue;
      }
      if (unevaluatedProperties === true) {
        continue;
      }
      const child = this.visit(unevaluatedProperties as JsonSchema, currentRoot, workingValue[key], `${path}/${escapeJsonPointer(key)}`, options, refStack, dynamicScope);

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

  private createImplicitDefault(
    schema: JsonSchema,
    currentRoot: JsonSchema,
    options: Required<Omit<GraphEngineOptions, 'formatRegistry' | 'keywords' | 'lookupSchema'>> & Pick<GraphEngineOptions, 'lookupSchema'>,
    refStack: Set<string>,
    dynamicScope: DynamicScopeEntry[]
  ): unknown {
    if (typeof schema === 'boolean') {
      return undefined;
    }
    const graph = isObject(currentRoot) ? this.graphFor(currentRoot) : undefined;
    const currentNode = graph?.node(schema);
    const nodePlan = this.schemaNodePlan(schema, graph, currentNode);
    const objectPlan = this.objectValidationPlan(schema, graph, currentNode);
    const defaultValue = keywordValue(graph, currentNode, schema, 'default');
    const ref = nodePlan.ref;
    const dynamicRef = nodePlan.dynamicRef;
    const schemaTypes = nodePlan.schemaTypes;

    if (defaultValue !== undefined) {
      return cloneDefault(defaultValue);
    }
    if (typeof ref === 'string') {
      const resolved = this.resolveRef(ref, currentRoot);

      return this.createImplicitDefault(resolved.schema, resolved.rootSchema, options, refStack, dynamicScope);
    }
    if (typeof dynamicRef === 'string') {
      const resolved = this.resolveDynamicRef(dynamicRef, currentRoot, dynamicScope);

      return this.createImplicitDefault(resolved.schema, resolved.rootSchema, options, refStack, dynamicScope);
    }

    const hasProperties = objectPlan.propertyEntries.length > 0;

    if (schemaTypes.includes('object') || hasProperties) {
      const result: Record<string, unknown> = {};
      let hasValue = false;
      const propertyEntries = objectPlan.propertyEntries;

      for (const [
        key,
        childSchema
      ] of propertyEntries) {
        const childValue = this.createImplicitDefault(childSchema as JsonSchema, currentRoot, options, refStack, dynamicScope);

        if (childValue !== undefined) {
          result[key] = childValue;
          hasValue = true;
        }
      }

      return hasValue ? result : undefined;
    }

    return undefined;
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

  private objectValidationPlan(
    schema: Record<string, unknown>,
    graph: SchemaGraph | undefined,
    currentNode: unknown
  ): ObjectValidationPlan {
    const cached = this.objectPlanCache.get(schema);

    if (cached !== undefined) {
      return cached;
    }

    const graphNode = currentNode as SchemaGraphNode | undefined;
    const semantics = graph !== undefined && graphNode !== undefined
      ? graph.semantics(graphNode)
      : undefined;
    const propertyEntries = semantics?.properties.map(([propertyName, propertyNode]) => {
      return [propertyName, propertyNode.schema] as [string, JsonSchema];
    }) ?? schemaEntries(graph, currentNode, schema, 'properties');
    const required = semantics?.required
      ?? (Array.isArray(keywordValue<string[]>(graph, currentNode, schema, 'required'))
        ? keywordValue<string[]>(graph, currentNode, schema, 'required') as string[]
        : []);
    const patternPropertyEntries = (semantics?.patternPropertyEntries.map(([pattern, patternNode]) => {
      return [pattern, patternNode.schema] as [string, JsonSchema];
    }) ?? schemaEntries(graph, currentNode, schema, 'patternProperties')).map(([pattern, patternSchema]) => {
      return {
        pattern,
        'regex': this.regexFor(pattern),
        'schema': patternSchema
      };
    });
    const dependentRequired = semantics?.dependentRequired
      ?? (isObject(keywordValue<Record<string, unknown>>(graph, currentNode, schema, 'dependentRequired'))
        ? Object.fromEntries(Object.entries(
          keywordValue<Record<string, unknown>>(graph, currentNode, schema, 'dependentRequired') as Record<string, unknown>
        ).flatMap(([key, value]) => {
          if (!Array.isArray(value)) {
            return [];
          }

          const entries = value.filter((entry): entry is string => {
            return typeof entry === 'string';
          });

          return [[key, entries] as [string, string[]]];
        }))
        : {});
    const dependentSchemaEntries = semantics?.dependentSchemaEntries.map(([key, dependencyNode]) => {
      return [key, dependencyNode.schema] as [string, JsonSchema];
    }) ?? schemaEntries(graph, currentNode, schema, 'dependentSchemas');
    const plan = {
      dependentRequired,
      dependentSchemaEntries,
      patternPropertyEntries,
      propertyEntries,
      'propertySchemaMap': new Map(propertyEntries),
      required
    };

    this.objectPlanCache.set(schema, plan);

    return plan;
  }

  private schemaNodePlan(
    schema: Record<string, unknown>,
    graph: SchemaGraph | undefined,
    currentNode: unknown
  ): SchemaNodePlan {
    const cached = this.nodePlanCache.get(schema);

    if (cached !== undefined) {
      return cached;
    }

    const graphNode = currentNode as SchemaGraphNode | undefined;
    const semantics = graph !== undefined && graphNode !== undefined
      ? graph.semantics(graphNode)
      : undefined;
    const prefixItems = semantics !== undefined
      ? (semantics.prefixItems.length > 0
        ? semantics.prefixItems.map((child) => {
          return child.schema;
        })
        : undefined)
      : (Array.isArray(keywordValue(graph, currentNode, schema, 'prefixItems'))
        ? indexedSchemaChildren(graph, currentNode, schema, 'prefixItems')
        : undefined);
    const plan = {
      'additionalProperties': childSchema(graph, currentNode, schema, 'additionalProperties')
        ?? keywordValue(graph, currentNode, schema, 'additionalProperties'),
      'allOf': semantics?.allOf.map((child) => {
        return child.schema;
      }) ?? indexedSchemaChildren(graph, currentNode, schema, 'allOf'),
      'anyOf': semantics?.anyOf.map((child) => {
        return child.schema;
      }) ?? indexedSchemaChildren(graph, currentNode, schema, 'anyOf'),
      'discriminatorPropertyName': (() => {
        const disc = schema.discriminator;

        if (typeof disc === 'object' && disc !== null && !Array.isArray(disc)) {
          const pn = (disc as Record<string, unknown>).propertyName;

          return typeof pn === 'string' ? pn : undefined;
        }

        return undefined;
      })(),
      'constValue': semantics !== undefined
        ? (semantics.hasConst ? semantics.constValue : undefined)
        : keywordValue(graph, currentNode, schema, 'const'),
      'containsSchema': semantics?.containsNode?.schema ?? childSchema(graph, currentNode, schema, 'contains'),
      'defaultValue': semantics !== undefined
        ? (semantics.hasDefault ? semantics.defaultValue : undefined)
        : keywordValue(graph, currentNode, schema, 'default'),
      'dynamicAnchor': semantics?.dynamicAnchor ?? (() => {
        const dynamicAnchorValue = keywordValue<string | boolean>(graph, currentNode, schema, '$dynamicAnchor');

        return typeof dynamicAnchorValue === 'string'
          ? dynamicAnchorValue
          : dynamicAnchorValue === true
            ? ''
            : undefined;
      })(),
      'dynamicRef': semantics?.dynamicRef ?? keywordValue<string>(graph, currentNode, schema, '$dynamicRef'),
      'elseSchema': semantics?.elseNode?.schema ?? childSchema(graph, currentNode, schema, 'else'),
      'enumValues': semantics?.enumValues ?? keywordValue<unknown[]>(graph, currentNode, schema, 'enum'),
      'exclusiveMaximum': semantics?.exclusiveMaximum ?? keywordValue<number>(graph, currentNode, schema, 'exclusiveMaximum'),
      'exclusiveMinimum': semantics?.exclusiveMinimum ?? keywordValue<number>(graph, currentNode, schema, 'exclusiveMinimum'),
      'format': semantics?.format ?? keywordValue<string>(graph, currentNode, schema, 'format'),
      'ifSchema': semantics?.ifNode?.schema ?? childSchema(graph, currentNode, schema, 'if'),
      'itemsSchema': Array.isArray(prefixItems)
        ? ((semantics?.itemsNode?.schema)
          ?? childSchema(graph, currentNode, schema, 'items')
          ?? keywordValue<JsonSchema | boolean>(graph, currentNode, schema, 'items'))
        : (semantics?.itemsNode?.schema ?? childSchema(graph, currentNode, schema, 'items')),
      'maxContains': keywordValue<number>(graph, currentNode, schema, 'maxContains'),
      'maxItems': semantics?.maxItems ?? keywordValue<number>(graph, currentNode, schema, 'maxItems'),
      'maxLength': semantics?.maxLength ?? keywordValue<number>(graph, currentNode, schema, 'maxLength'),
      'maxProperties': semantics?.maxProperties ?? keywordValue<number>(graph, currentNode, schema, 'maxProperties'),
      'maximum': semantics?.maximum ?? keywordValue<number>(graph, currentNode, schema, 'maximum'),
      'minContains': keywordValue<number>(graph, currentNode, schema, 'minContains'),
      'minItems': semantics?.minItems ?? keywordValue<number>(graph, currentNode, schema, 'minItems'),
      'minLength': semantics?.minLength ?? keywordValue<number>(graph, currentNode, schema, 'minLength'),
      'minProperties': semantics?.minProperties ?? keywordValue<number>(graph, currentNode, schema, 'minProperties'),
      'minimum': semantics?.minimum ?? keywordValue<number>(graph, currentNode, schema, 'minimum'),
      'multipleOf': semantics?.multipleOf ?? keywordValue<number>(graph, currentNode, schema, 'multipleOf'),
      'notSchema': semantics?.notNode?.schema ?? childSchema(graph, currentNode, schema, 'not'),
      'oneOf': semantics?.oneOf.map((child) => {
        return child.schema;
      }) ?? indexedSchemaChildren(graph, currentNode, schema, 'oneOf'),
      'pattern': semantics?.pattern ?? keywordValue<string>(graph, currentNode, schema, 'pattern'),
      prefixItems,
      'propertyNamesSchema': semantics?.propertyNamesNode?.schema ?? childSchema(graph, currentNode, schema, 'propertyNames'),
      'ref': semantics?.ref ?? keywordValue<string>(graph, currentNode, schema, '$ref'),
      'schemaTypes': semantics?.schemaTypes ?? toArray(keywordValue<string | string[]>(graph, currentNode, schema, 'type')),
      'thenSchema': semantics?.thenNode?.schema ?? childSchema(graph, currentNode, schema, 'then'),
      'tupleItems': undefined,
      'unevaluatedItems': semantics?.unevaluatedItemsNode?.schema
        ?? childSchema(graph, currentNode, schema, 'unevaluatedItems')
        ?? keywordValue(graph, currentNode, schema, 'unevaluatedItems'),
      'unevaluatedProperties': semantics?.unevaluatedPropertiesNode?.schema
        ?? childSchema(graph, currentNode, schema, 'unevaluatedProperties')
        ?? keywordValue(graph, currentNode, schema, 'unevaluatedProperties'),
      'uniqueItems': semantics !== undefined
        ? semantics.uniqueItems
        : keywordValue<boolean>(graph, currentNode, schema, 'uniqueItems') === true
    };

    this.nodePlanCache.set(schema, plan);

    return plan;
  }

  private rootDialectPlan(rootSchema: JsonSchema): RootDialectPlan {
    if (!isObject(rootSchema)) {
      return { 'formatAssertions': true };
    }

    const schemaUri = typeof rootSchema.$schema === 'string' ? rootSchema.$schema : undefined;

    if (schemaUri !== undefined && !schemaUri.startsWith(CURRENT_DIALECT_PREFIX)) {
      throw new Error(`Unsupported JSON Schema dialect: ${schemaUri}`);
    }

    const rawVocabulary = isObject(rootSchema.$vocabulary)
      ? rootSchema.$vocabulary as Record<string, unknown>
      : undefined;
    let formatAssertions = schemaUri === undefined ? true : false;

    if (rawVocabulary !== undefined) {
      for (const [uri, enabled] of Object.entries(rawVocabulary)) {
        if (enabled === true && !SUPPORTED_VOCABULARIES.has(uri)) {
          throw new Error(`Unsupported required JSON Schema vocabulary: ${uri}`);
        }
      }

      if (typeof rawVocabulary[VOCABULARY_FORMAT_ASSERTION] === 'boolean') {
        formatAssertions = rawVocabulary[VOCABULARY_FORMAT_ASSERTION] === true;
      }
    } else if (schemaUri === DEFAULT_DIALECT_URI) {
      formatAssertions = false;
    }

    return { formatAssertions };
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
