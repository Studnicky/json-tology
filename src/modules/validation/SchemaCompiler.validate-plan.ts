import type { FormatRegistryInterface } from '../../interfaces/format-registry.js';
import type { KeywordDefinitionInterface } from '../../interfaces/graph-engine.js';
import type {
  SchemaGraphNodeInterface, SchemaGraphSemanticsInterface
} from '../../interfaces/schema-graph.js';
import type { SchemaGraphInterface } from '../../interfaces/schema-graph-impl.js';
import { SchemaGraph } from '../graph/SchemaGraph.js';
import { isRecord } from '../data/DataTypes.js';
import type { ValidationErrorType } from '../../types/validation.js';
import { makeValidationError } from './SchemaCompiler.support.js';

export type ValidateWithErrorsFnType = (
  value: unknown,
  path: string,
  errors: ValidationErrorType[],
  collectErrors: boolean,
  applyDefaults: boolean,
  doCoerce: boolean,
  stripUnknown: boolean
) => { 'valid': boolean;
  'value': unknown; };

type CheckFnType = (value: unknown) => boolean;

export interface CustomKeywordEntryInterface {
  readonly 'allowedTypes': string[] | undefined;
  readonly 'keyword': string;
  readonly 'schemaValue': unknown;
  readonly 'validate': KeywordDefinitionInterface['validate'];
}

export interface CompiledNodeValidationPlanInterface {
  readonly 'additionalIsFalse': boolean;
  readonly 'additionalValidator': undefined | ValidateWithErrorsFnType;
  readonly 'allOfValidators': undefined | ValidateWithErrorsFnType[];
  readonly 'allowedKeys': Set<string> | undefined;
  readonly 'anyOfChecks': CheckFnType[] | undefined;
  readonly 'constVal': unknown;
  readonly 'containsCheck': CheckFnType | undefined;
  readonly 'customKeywordEntries': CustomKeywordEntryInterface[] | undefined;
  readonly 'defaultValue': unknown;
  readonly 'depRequiredEntries': Array<[string, string[]]>;
  readonly 'depSchemaValidators': Array<{ 'trigger': string;
    'validator': ValidateWithErrorsFnType; }> | undefined;
  readonly 'elseValidator': undefined | ValidateWithErrorsFnType;
  readonly 'enumSet': Set<boolean | null | number | string> | undefined;
  readonly 'enumValues': undefined | unknown[];
  readonly 'exclusiveMaximum': number | undefined;
  readonly 'exclusiveMinimum': number | undefined;
  readonly 'format': string | undefined;
  readonly 'formatValidator': ((value: unknown) => boolean) | undefined;
  readonly 'hasConst': boolean;
  readonly 'hasDefault': boolean;
  readonly 'ifCheck': CheckFnType | undefined;
  readonly 'itemValidator': undefined | ValidateWithErrorsFnType;
  readonly 'maxContains': number | undefined;
  readonly 'maximum': number | undefined;
  readonly 'maxItems': number | undefined;
  readonly 'maxLength': number | undefined;
  readonly 'maxProperties': number | undefined;
  readonly 'minContains': number | undefined;
  readonly 'minimum': number | undefined;
  readonly 'minItems': number | undefined;
  readonly 'minLength': number | undefined;
  readonly 'minProperties': number | undefined;
  readonly 'multipleOf': number | undefined;
  readonly 'notCheck': CheckFnType | undefined;
  readonly 'oneOfChecks': CheckFnType[] | undefined;
  readonly 'pattern': string | undefined;
  readonly 'patternPropValidators': Array<{ 'regex': RegExp;
    'validator': ValidateWithErrorsFnType; }> | undefined;
  readonly 'patternRegex': RegExp | undefined;
  readonly 'prefixValidators': undefined | ValidateWithErrorsFnType[];
  readonly 'propertyDefaults': Map<string, { 'defaultValue': unknown;
    'hasDefault': boolean; }>;
  readonly 'propertyNamesValidator': undefined | ValidateWithErrorsFnType;
  readonly 'propValidators': Map<string, ValidateWithErrorsFnType>;
  readonly 'refValidator': undefined | ValidateWithErrorsFnType;
  readonly 'required': string[] | undefined;
  readonly 'thenValidator': undefined | ValidateWithErrorsFnType;
  readonly 'types': string[];
  readonly 'uniqueItems': boolean;
}

export interface SchemaCompilerValidatePlanContextInterface {
  readonly 'activeCustomKeywords': KeywordDefinitionInterface[];
  readonly 'compileNodeCheck': (
    graphNode: SchemaGraphNodeInterface,
    formatRegistry: FormatRegistryInterface,
    graph: SchemaGraphInterface,
    lookupSchema?: (id: string) => Record<string, unknown> | undefined
  ) => CheckFnType;
  readonly 'compileNodeOrBooleanCheck': (
    node: SchemaGraphNodeInterface,
    formatRegistry: FormatRegistryInterface,
    graph: SchemaGraphInterface,
    lookupSchema?: (id: string) => Record<string, unknown> | undefined
  ) => CheckFnType;
  readonly 'compileNodeOrBooleanValidateWithErrors': (
    node: SchemaGraphNodeInterface,
    formatRegistry: FormatRegistryInterface,
    graph: SchemaGraphInterface,
    lookupSchema?: (id: string) => Record<string, unknown> | undefined
  ) => ValidateWithErrorsFnType;
  readonly 'compileNodeValidateWithErrors': (
    graphNode: SchemaGraphNodeInterface,
    formatRegistry: FormatRegistryInterface,
    graph: SchemaGraphInterface,
    lookupSchema?: (id: string) => Record<string, unknown> | undefined
  ) => ValidateWithErrorsFnType;
  readonly 'hasFormatAssertions': (sem: SchemaGraphSemanticsInterface) => boolean;
  readonly 'resolveImplicitDefault': (
    node: SchemaGraphNodeInterface,
    graph: SchemaGraphInterface,
    lookupSchema: ((id: string) => Record<string, unknown> | undefined) | undefined,
    visited: Set<unknown>
  ) => unknown;
}

function booleanValidateWithErrors(schema: boolean): ValidateWithErrorsFnType {
  return schema
    ? (value, _path, _errors, _collect, _applyDef, _doCoerce, _stripUnk) => {
      return {
        'valid': true,
        'value': value
      };
    }
    : (value, path, errors, collectErrors) => {
      if (collectErrors) {
        errors.push(makeValidationError(path, 'falseSchema', 'must not match false schema'));
      }

      return {
        'valid': false,
        'value': value
      };
    };
}

function compilePropertyValidators(
  context: SchemaCompilerValidatePlanContextInterface,
  propertyEntries: Map<string, SchemaGraphNodeInterface>,
  formatRegistry: FormatRegistryInterface,
  graph: SchemaGraphInterface,
  lookupSchema?: (id: string) => Record<string, unknown> | undefined
): Map<string, ValidateWithErrorsFnType> {
  const propValidators = new Map<string, ValidateWithErrorsFnType>();

  for (const [
    key,
    propNode
  ] of propertyEntries) {
    propValidators.set(
      key,
      typeof propNode.schema === 'boolean'
        ? booleanValidateWithErrors(propNode.schema)
        : context.compileNodeValidateWithErrors(propNode, formatRegistry, graph, lookupSchema)
    );
  }

  return propValidators;
}

function compileRefValidator(
  context: SchemaCompilerValidatePlanContextInterface,
  ref: string | undefined,
  formatRegistry: FormatRegistryInterface,
  graph: SchemaGraphInterface,
  lookupSchema?: (id: string) => Record<string, unknown> | undefined
): undefined | ValidateWithErrorsFnType {
  if (typeof ref !== 'string') {
    return undefined;
  }

  if (ref.startsWith('#')) {
    const fragment = ref.slice(1);
    let targetNode: SchemaGraphNodeInterface | undefined;

    try {
      targetNode = graph.resolveFragment(fragment);
    } catch {
      // Fall through
    }

    if (targetNode !== undefined) {
      if (typeof targetNode.schema === 'boolean') {
        return booleanValidateWithErrors(targetNode.schema);
      }

      let cached: undefined | ValidateWithErrorsFnType;

      return (value, path, errors, collectErrors, applyDef, doCoerce, stripUnk) => {
        cached ??= context.compileNodeValidateWithErrors(targetNode, formatRegistry, graph, lookupSchema);

        return cached(value, path, errors, collectErrors, applyDef, doCoerce, stripUnk);
      };
    }

    return undefined;
  }

  if (lookupSchema === undefined) {
    return undefined;
  }

  const hashIndex = ref.indexOf('#');
  const schemaId = hashIndex === -1 ? ref : ref.slice(0, hashIndex);
  const fragment = hashIndex === -1 ? '' : ref.slice(hashIndex + 1);
  const refSchema = lookupSchema(schemaId);

  if (refSchema === undefined) {
    return undefined;
  }

  const refGraph = new SchemaGraph(refSchema);

  if (fragment !== '' && fragment !== '/') {
    let targetNode: SchemaGraphNodeInterface | undefined;

    try {
      targetNode = refGraph.resolveFragment(fragment);
    } catch {
      // Fall through
    }

    if (targetNode !== undefined) {
      if (typeof targetNode.schema === 'boolean') {
        return booleanValidateWithErrors(targetNode.schema);
      }

      let cached: undefined | ValidateWithErrorsFnType;

      return (value, path, errors, collectErrors, applyDef, doCoerce, stripUnk) => {
        cached ??= context.compileNodeValidateWithErrors(targetNode, formatRegistry, refGraph, lookupSchema);

        return cached(value, path, errors, collectErrors, applyDef, doCoerce, stripUnk);
      };
    }

    return undefined;
  }

  let cached: undefined | ValidateWithErrorsFnType;
  const rootNode = refGraph.rootNode;

  return (value, path, errors, collectErrors, applyDef, doCoerce, stripUnk) => {
    cached ??= context.compileNodeValidateWithErrors(rootNode, formatRegistry, refGraph, lookupSchema);

    return cached(value, path, errors, collectErrors, applyDef, doCoerce, stripUnk);
  };
}

function buildPropertyDefaults(
  context: SchemaCompilerValidatePlanContextInterface,
  propertyEntries: Map<string, SchemaGraphNodeInterface>,
  graph: SchemaGraphInterface,
  lookupSchema?: (id: string) => Record<string, unknown> | undefined
): Map<string, { 'defaultValue': unknown;
  'hasDefault': boolean; }> {
  const propertyDefaults = new Map<string, { 'defaultValue': unknown;
    'hasDefault': boolean; }>();

  for (const [
    key,
    propNode
  ] of propertyEntries) {
    if (!isRecord(propNode.schema)) {
      continue;
    }
    const propSem = graph.semantics(propNode);

    if (propSem.hasDefault) {
      propertyDefaults.set(key, {
        'defaultValue': propSem.defaultValue,
        'hasDefault': true
      });
      continue;
    }

    const implicit = context.resolveImplicitDefault(propNode, graph, lookupSchema, new Set());

    if (implicit !== undefined) {
      propertyDefaults.set(key, {
        'defaultValue': implicit,
        'hasDefault': true
      });
    }
  }

  return propertyDefaults;
}

function buildCustomKeywordEntries(
  activeCustomKeywords: KeywordDefinitionInterface[],
  sem: SchemaGraphSemanticsInterface
): CustomKeywordEntryInterface[] | undefined {
  if (activeCustomKeywords.length === 0) {
    return undefined;
  }

  const entries: CustomKeywordEntryInterface[] = [];

  for (const kw of activeCustomKeywords) {
    if (kw.keyword in sem.extensions) {
      let allowedTypes: string[] | undefined;

      if (kw.type === undefined) {
        allowedTypes = undefined;
      } else {
        allowedTypes = Array.isArray(kw.type) ? kw.type : [kw.type];
      }
      entries.push({
        allowedTypes,
        'keyword': kw.keyword,
        'schemaValue': sem.extensions[kw.keyword],
        'validate': kw.validate
      });
    }
  }

  return entries.length > 0 ? entries : undefined;
}

export function buildNodeValidationPlan(
  context: SchemaCompilerValidatePlanContextInterface,
  graphNode: SchemaGraphNodeInterface,
  formatRegistry: FormatRegistryInterface,
  graph: SchemaGraphInterface,
  lookupSchema?: (id: string) => Record<string, unknown> | undefined
): CompiledNodeValidationPlanInterface {
  const sem = graph.semantics(graphNode);
  const propertyEntries = sem.properties;
  const patternRegex = sem.pattern === undefined ? undefined : new RegExp(sem.pattern, 'u');
  const formatValidator = (sem.format !== undefined && context.hasFormatAssertions(sem))
    ? formatRegistry.get(sem.format)
    : undefined;
  const additionalValidator = sem.additionalPropertiesNode !== undefined
    && sem.additionalPropertiesNode !== true
    && sem.additionalPropertiesNode !== false
    ? context.compileNodeOrBooleanValidateWithErrors(sem.additionalPropertiesNode, formatRegistry, graph, lookupSchema)
    : undefined;

  const patternPropValidators = sem.patternPropertyEntries.length > 0
    ? sem.patternPropertyEntries.map(([
      pat,
      patNode
    ]) => {
      return {
        'regex': new RegExp(pat, 'u'),
        'validator': context.compileNodeOrBooleanValidateWithErrors(patNode, formatRegistry, graph, lookupSchema)
      };
    })
    : undefined;

  const prefixValidators = sem.prefixItems.length > 0
    ? sem.prefixItems.map((node) => {
      return context.compileNodeOrBooleanValidateWithErrors(node, formatRegistry, graph, lookupSchema);
    })
    : undefined;

  const containsCheck = sem.containsNode === undefined
    ? undefined
    : context.compileNodeOrBooleanCheck(sem.containsNode, formatRegistry, graph, lookupSchema);

  const itemValidator = sem.itemsNode === undefined
    ? undefined
    : context.compileNodeOrBooleanValidateWithErrors(sem.itemsNode, formatRegistry, graph, lookupSchema);

  const allOfValidators = sem.allOf.length > 0
    ? sem.allOf.map((node) => {
      return context.compileNodeOrBooleanValidateWithErrors(node, formatRegistry, graph, lookupSchema);
    })
    : undefined;

  const anyOfChecks = sem.anyOf.length > 0
    ? sem.anyOf.map((node) => {
      return context.compileNodeOrBooleanCheck(node, formatRegistry, graph, lookupSchema);
    })
    : undefined;

  const oneOfChecks = sem.oneOf.length > 0
    ? sem.oneOf.map((node) => {
      return context.compileNodeOrBooleanCheck(node, formatRegistry, graph, lookupSchema);
    })
    : undefined;

  const notCheck = sem.notNode === undefined
    ? undefined
    : context.compileNodeOrBooleanCheck(sem.notNode, formatRegistry, graph, lookupSchema);

  const ifCheck = sem.ifNode === undefined
    ? undefined
    : context.compileNodeOrBooleanCheck(sem.ifNode, formatRegistry, graph, lookupSchema);
  const thenValidator = sem.ifNode !== undefined && sem.thenNode !== undefined
    ? context.compileNodeOrBooleanValidateWithErrors(sem.thenNode, formatRegistry, graph, lookupSchema)
    : undefined;
  const elseValidator = sem.ifNode !== undefined && sem.elseNode !== undefined
    ? context.compileNodeOrBooleanValidateWithErrors(sem.elseNode, formatRegistry, graph, lookupSchema)
    : undefined;

  const depRequiredEntries = Object.entries(sem.dependentRequired).filter(([
    ,
    v
  ]) => {
    return Array.isArray(v) && v.length > 0;
  });

  const depSchemaValidators = sem.dependentSchemaEntries.length > 0
    ? sem.dependentSchemaEntries.map(([
      trigger,
      node
    ]) => {
      return {
        'trigger': trigger,
        'validator': context.compileNodeOrBooleanValidateWithErrors(node, formatRegistry, graph, lookupSchema)
      };
    })
    : undefined;

  const propertyNamesValidator = sem.propertyNamesNode === undefined
    ? undefined
    : context.compileNodeOrBooleanValidateWithErrors(sem.propertyNamesNode, formatRegistry, graph, lookupSchema);

  // eslint-disable-next-line @typescript-eslint/prefer-optional-chain
  const enumSet = sem.enumValues !== undefined && sem.enumValues.every((ev) => {
    return ev === null || typeof ev === 'string' || typeof ev === 'number' || typeof ev === 'boolean';
  })
    ? new Set<boolean | null | number | string>(sem.enumValues)
    : undefined;

  return {
    'additionalIsFalse': sem.additionalPropertiesNode === false,
    additionalValidator,
    allOfValidators,
    'allowedKeys': propertyEntries.size > 0 ? new Set(propertyEntries.keys()) : undefined,
    anyOfChecks,
    'constVal': sem.constValue,
    containsCheck,
    'customKeywordEntries': buildCustomKeywordEntries(context.activeCustomKeywords, sem),
    'defaultValue': sem.defaultValue,
    depRequiredEntries,
    depSchemaValidators,
    elseValidator,
    enumSet,
    'enumValues': sem.enumValues,
    'exclusiveMaximum': sem.exclusiveMaximum,
    'exclusiveMinimum': sem.exclusiveMinimum,
    'format': sem.format,
    formatValidator,
    'hasConst': sem.hasConst,
    'hasDefault': sem.hasDefault,
    ifCheck,
    itemValidator,
    'maxContains': sem.maxContains,
    'maximum': sem.maximum,
    'maxItems': sem.maxItems,
    'maxLength': sem.maxLength,
    'maxProperties': sem.maxProperties,
    'minContains': sem.minContains,
    'minimum': sem.minimum,
    'minItems': sem.minItems,
    'minLength': sem.minLength,
    'minProperties': sem.minProperties,
    'multipleOf': sem.multipleOf,
    notCheck,
    oneOfChecks,
    'pattern': sem.pattern,
    patternPropValidators,
    patternRegex,
    prefixValidators,
    'propertyDefaults': buildPropertyDefaults(context, propertyEntries, graph, lookupSchema),
    propertyNamesValidator,
    'propValidators': compilePropertyValidators(context, propertyEntries, formatRegistry, graph, lookupSchema),
    'refValidator': compileRefValidator(context, sem.ref, formatRegistry, graph, lookupSchema),
    'required': sem.required.length > 0 ? sem.required : undefined,
    thenValidator,
    'types': sem.schemaTypes,
    'uniqueItems': sem.uniqueItems
  };
}
