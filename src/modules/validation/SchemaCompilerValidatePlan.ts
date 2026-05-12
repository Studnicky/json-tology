import type { FormatRegistryInterface } from '../../interfaces/FormatRegistry.js';
import type { KeywordDefinitionInterface } from '../../interfaces/GraphEngine.js';
import type {
  SchemaGraphNodeInterface, SchemaGraphSemanticsInterface
} from '../../interfaces/SchemaGraph.js';
import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphImpl.js';
import { isRecord } from '../data/DataTypes.js';
import type { ValidateWithErrorsFnType } from '../../types/Validation.js';
import { BaseError } from '../../errors/BaseError.js';
import { SchemaCompilerSupport } from './SchemaCompilerSupport.js';
import { RefResolver } from './RefResolver.js';
import type { CustomKeywordEntryInterface } from '../../interfaces/CustomKeywordEntry.js';
import type { CompiledNodeValidationPlanInterface } from '../../interfaces/CompiledNodeValidationPlan.js';
import type { SchemaCompilerValidatePlanContextInterface } from '../../interfaces/SchemaCompilerValidatePlanContext.js';

function booleanValidateWithErrors(schema: boolean): ValidateWithErrorsFnType {
  return schema
    ? (value) => {
      return {
        'valid': true,
        'value': value
      };
    }
    : (value, path, errors, collectErrors) => {
      if (collectErrors) {
        errors.push(BaseError.validationError(path, 'falseSchema', 'must not match false schema'));
      }

      return {
        'valid': false,
        'value': value
      };
    };
}

function wrapStrictValidator(inner: ValidateWithErrorsFnType): ValidateWithErrorsFnType {
  return (value, path, errors, collectErrors, applyDefaults, _doCoerce, stripUnknown) => {
    return inner(value, path, errors, collectErrors, applyDefaults, false, stripUnknown);
  };
}

function compilePropertyValidators(
  context: SchemaCompilerValidatePlanContextInterface,
  propertyEntries: Map<string, SchemaGraphNodeInterface>,
  formatRegistry: FormatRegistryInterface,
  graph: SchemaGraphInterface,
  configStrict: boolean | undefined,
  lookupSchema?: (id: string) => Record<string, unknown> | undefined
): Map<string, ValidateWithErrorsFnType> {
  const propValidators = new Map<string, ValidateWithErrorsFnType>();

  for (const [
    key,
    propNode
  ] of propertyEntries) {
    const compiled = typeof propNode.schema === 'boolean'
      ? booleanValidateWithErrors(propNode.schema)
      : context.compileNodeValidateWithErrors(propNode, formatRegistry, graph, lookupSchema);

    const propSem = typeof propNode.schema === 'boolean' ? undefined : graph.semantics(propNode);
    const fieldStrict = propSem?.jtStrict ?? configStrict;

    propValidators.set(
      key,
      fieldStrict === true ? wrapStrictValidator(compiled) : compiled
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

  const resolved = RefResolver.resolve(ref, graph, lookupSchema);

  if (resolved === undefined) {
    return undefined;
  }

  const {
    'graph': targetGraph, 'node': targetNode
  } = resolved;

  if (typeof targetNode.schema === 'boolean') {
    return booleanValidateWithErrors(targetNode.schema);
  }

  let cached: undefined | ValidateWithErrorsFnType;

  return (value, path, errors, collectErrors, applyDef, doCoerce, stripUnk) => {
    cached ??= context.compileNodeValidateWithErrors(targetNode, formatRegistry, targetGraph, lookupSchema);

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
      entries.push({
        'allowedTypes': SchemaCompilerSupport.normalizeKeywordTypes(kw.type),
        'keyword': kw.keyword,
        'schemaValue': sem.extensions[kw.keyword],
        'validate': kw.validate
      });
    }
  }

  return entries.length > 0 ? entries : undefined;
}

function buildJtStrictPerField(
  propertyEntries: Map<string, SchemaGraphNodeInterface>,
  graph: SchemaGraphInterface
): Map<string, boolean> | undefined {
  const result = new Map<string, boolean>();

  for (const [
    key,
    propNode
  ] of propertyEntries) {
    const propSem = graph.semantics(propNode);

    if (propSem.jtStrict !== undefined) {
      result.set(key, propSem.jtStrict);
    }
  }

  return result.size > 0 ? result : undefined;
}

export const SchemaCompilerValidatePlan = {
  buildNodeValidationPlan(
    context: SchemaCompilerValidatePlanContextInterface,
    graphNode: SchemaGraphNodeInterface,
    formatRegistry: FormatRegistryInterface,
    graph: SchemaGraphInterface,
    lookupSchema?: (id: string) => Record<string, unknown> | undefined
  ): CompiledNodeValidationPlanInterface {
    const sem = graph.semantics(graphNode);
    const propertyEntries = sem.properties;
    const patternRegex = sem.pattern === undefined ? undefined : new RegExp(sem.pattern, 'u');
    const formatValidator = (sem.format !== undefined && context.appliesFormatAssertions(sem))
      ? formatRegistry.get(sem.format)
      : undefined;
    const additionalPropertiesNode = sem.additionalPropertiesNode;
    const additionalValidator = additionalPropertiesNode !== undefined
      && additionalPropertiesNode !== true
      && additionalPropertiesNode !== false
      ? context.compileNodeOrBooleanValidateWithErrors(additionalPropertiesNode, formatRegistry, graph, lookupSchema)
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

    const complementCheck = sem.complementNode === undefined
      ? undefined
      : context.compileNodeOrBooleanCheck(sem.complementNode, formatRegistry, graph, lookupSchema);

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
      values
    ]) => {
      return Array.isArray(values) && values.length > 0;
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

    const enumSet = sem.enumValues?.every((ev) => {
      return ev === null || typeof ev === 'string' || typeof ev === 'number' || typeof ev === 'boolean';
    }) === true
      ? new Set<boolean | null | number | string>(sem.enumValues)
      : undefined;

    const propertyAliases = new Map<string, string>();

    for (const [
      canonicalKey,
      propNode
    ] of propertyEntries) {
      const propSem = graph.semantics(propNode);

      for (const alias of propSem.aliases) {
        propertyAliases.set(alias, canonicalKey);
      }
    }

    const allowedKeys = propertyEntries.size > 0 ? new Set(propertyEntries.keys()) : undefined;

    if (allowedKeys !== undefined) {
      for (const alias of propertyAliases.keys()) {
        allowedKeys.add(alias);
      }
    }

    const jtExtra = sem.jtConfig?.extra;
    const jtStrictPerField = buildJtStrictPerField(propertyEntries, graph);

    return {
      'additionalIsFalse': sem.additionalPropertiesNode === false,
      additionalValidator,
      allOfValidators,
      allowedKeys,
      anyOfChecks,
      complementCheck,
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
      'jtExtra': jtExtra,
      'jtStrictPerField': jtStrictPerField,
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
      oneOfChecks,
      'pattern': sem.pattern,
      patternPropValidators,
      patternRegex,
      prefixValidators,
      propertyAliases,
      'propertyDefaults': buildPropertyDefaults(context, propertyEntries, graph, lookupSchema),
      propertyNamesValidator,
      'propValidators': compilePropertyValidators(context, propertyEntries, formatRegistry, graph, sem.jtConfig?.strict, lookupSchema),
      'refValidator': compileRefValidator(context, sem.ref, formatRegistry, graph, lookupSchema),
      'required': sem.required.length > 0 ? sem.required : undefined,
      thenValidator,
      'types': sem.schemaTypes,
      'uniqueItems': sem.uniqueItems
    };
  }
} as const;
