/**
 * SchemaCompilerPlan — plan-time graph helpers and node validation plan builder.
 *
 * Merged from SchemaCompilerGraph.ts (check-time graph traversal) and
 * SchemaCompilerValidatePlan.ts (validate-time plan construction).
 *
 * Exports:
 *   buildNodePlan     — single keyword traversal → CompiledNodeValidationPlanInterface
 *   graph helpers     — compileArrayCheck, compileConstCheck, compileEnumCheck,
 *                       compileObjectCheck, compileRefCheck,
 *                       nodeSupportsCompilation, tryCompileFlatObjectCheck
 */

import type { CheckFnType } from '../../types/Validation.js';
import type { FormatRegistryInterface } from '../../interfaces/FormatRegistry.js';
import type { PropCheckInterface } from '../../interfaces/PropCheck.js';
import type { SchemaCompilerGraphContextInterface } from '../../interfaces/SchemaCompilerGraphContext.js';
import type {
  SchemaGraphNodeInterface, SchemaGraphSemanticsInterface
} from '../../interfaces/SchemaGraph.js';
import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphImpl.js';
import type { KeywordDefinitionInterface } from '../../interfaces/GraphEngine.js';
import type { ValidateWithErrorsFnType } from '../../types/Validation.js';
import type { CustomKeywordEntryInterface } from '../../interfaces/CustomKeywordEntry.js';
import type { CompiledNodeValidationPlanInterface } from '../../interfaces/CompiledNodeValidationPlan.js';
import type { SchemaCompilerValidatePlanContextInterface } from '../../interfaces/SchemaCompilerValidatePlanContext.js';
import {
  deepEqual, isRecord
} from '../data/DataTypes.js';
import { SchemaGraph } from '../graph/SchemaGraph.js';
import { Predicates } from './Predicates.js';
import { RefResolver } from './RefResolver.js';
import { BaseError } from '../../errors/BaseError.js';
import { SchemaCompilerSupport } from './SchemaCompilerSupport.js';

// ---------------------------------------------------------------------------
// Internal helpers (graph context)
// ---------------------------------------------------------------------------

function canUseFlatObjectFastPath(
  context: SchemaCompilerGraphContextInterface,
  sem: SchemaGraphSemanticsInterface
): boolean {
  if (!sem.schemaTypes.includes('object')) {
    return false;
  }
  if (sem.allOf.length > 0 || sem.anyOf.length > 0 || sem.oneOf.length > 0
    || sem.complementNode !== undefined || sem.ifNode !== undefined) {
    return false;
  }
  if (sem.ref !== undefined) {
    return false;
  }
  if (sem.patternPropertyEntries.length > 0) {
    return false;
  }
  if (sem.minProperties !== undefined || sem.maxProperties !== undefined) {
    return false;
  }
  if (sem.additionalPropertiesNode !== undefined
    && sem.additionalPropertiesNode !== false
    && sem.additionalPropertiesNode !== true) {
    return false;
  }
  if (sem.containsNode !== undefined) {
    return false;
  }
  if (Object.keys(sem.dependentRequired).length > 0) {
    return false;
  }
  if (sem.dependentSchemaEntries.length > 0) {
    return false;
  }
  if (context.activeCustomKeywords.length > 0 && Object.keys(sem.extensions).length > 0) {
    return false;
  }

  return sem.properties.size > 0;
}

function buildFlatObjectPropertyChecks(
  context: SchemaCompilerGraphContextInterface,
  sem: SchemaGraphSemanticsInterface,
  formatRegistry: FormatRegistryInterface,
  graph: SchemaGraphInterface,
  lookupSchema?: (id: string) => Record<string, unknown> | undefined
): PropCheckInterface[] {
  const requiredSet = new Set(sem.required);
  const propChecks: PropCheckInterface[] = [];

  for (const [
    name,
    propNode
  ] of sem.properties) {
    propChecks.push({
      'check': context.compileNodeOrBooleanCheck(propNode, formatRegistry, graph, lookupSchema),
      name,
      'required': requiredSet.has(name)
    });
  }

  return propChecks;
}

// ---------------------------------------------------------------------------
// Graph helpers (check-time)
// ---------------------------------------------------------------------------

export function compileArrayCheck(
  context: SchemaCompilerGraphContextInterface,
  graphNode: SchemaGraphNodeInterface,
  formatRegistry: FormatRegistryInterface,
  graph: SchemaGraphInterface,
  lookupSchema?: (id: string) => Record<string, unknown> | undefined
): CheckFnType | undefined {
  const sem = graph.semantics(graphNode);
  const minItems = sem.minItems;
  const maxItems = sem.maxItems;
  const uniqueItems = sem.uniqueItems;
  const itemsNode = sem.itemsNode;
  const prefixItemNodes = sem.prefixItems;
  const containsNode = sem.containsNode;
  const minContains = sem.minContains;
  const maxContains = sem.maxContains;

  let itemCheck: CheckFnType | undefined;

  if (itemsNode !== undefined) {
    if (typeof itemsNode.schema === 'boolean') {
      if (!itemsNode.schema) {
        itemCheck = () => {
          return false;
        };
      }
    } else {
      itemCheck = context.compileNodeCheck(itemsNode, formatRegistry, graph, lookupSchema);
    }
  }

  const prefixChecks = prefixItemNodes.length > 0
    ? prefixItemNodes.map((node) => {
      return context.compileNodeOrBooleanCheck(node, formatRegistry, graph, lookupSchema);
    })
    : undefined;

  const containsCheck = containsNode === undefined
    ? undefined
    : context.compileNodeOrBooleanCheck(containsNode, formatRegistry, graph, lookupSchema);

  return (value) => {
    if (!Array.isArray(value)) {
      return true;
    }

    if (minItems !== undefined && value.length < minItems) {
      return false;
    }
    if (maxItems !== undefined && value.length > maxItems) {
      return false;
    }

    if (uniqueItems && !Predicates.satisfiesUniqueItems(value)) {
      return false;
    }

    if (prefixChecks !== undefined) {
      for (let i = 0; i < prefixChecks.length && i < value.length; i++) {
        if (!prefixChecks[i](value[i])) {
          return false;
        }
      }
    }

    if (itemCheck !== undefined) {
      const startIndex = prefixChecks === undefined ? 0 : prefixChecks.length;

      for (let i = startIndex; i < value.length; i++) {
        if (!itemCheck(value[i])) {
          return false;
        }
      }
    }

    if (containsCheck !== undefined) {
      let count = 0;

      for (const item of value) {
        if (containsCheck(item)) {
          count++;
        }
      }
      if (minContains !== undefined && count < minContains) {
        return false;
      }
      if (maxContains !== undefined && count > maxContains) {
        return false;
      }
      if (minContains === undefined && maxContains === undefined && count === 0) {
        return false;
      }
    }

    return true;
  };
}

export function compileConstCheck(constValue: unknown): CheckFnType {
  if (constValue === null || typeof constValue === 'string' || typeof constValue === 'number' || typeof constValue === 'boolean') {
    return (value) => {
      return value === constValue;
    };
  }

  return (value) => {
    return deepEqual(value, constValue);
  };
}

export function compileEnumCheck(enumValues: unknown[]): CheckFnType {
  const allPrimitive = enumValues.every((entry) => {
    return entry === null || typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean';
  });

  if (allPrimitive) {
    const enumSet = new Set(enumValues);

    return (value) => {
      return enumSet.has(value as boolean | null | number | string);
    };
  }

  return (value) => {
    return enumValues.some((entry) => {
      return deepEqual(entry, value);
    });
  };
}

export function compileObjectCheck(
  context: SchemaCompilerGraphContextInterface,
  graphNode: SchemaGraphNodeInterface,
  formatRegistry: FormatRegistryInterface,
  graph: SchemaGraphInterface,
  lookupSchema?: (id: string) => Record<string, unknown> | undefined
): CheckFnType | undefined {
  const sem = graph.semantics(graphNode);
  const propValidators = new Map<string, CheckFnType>();

  for (const [
    key,
    propNode
  ] of sem.properties) {
    if (typeof propNode.schema === 'boolean') {
      if (!propNode.schema) {
        propValidators.set(key, () => {
          return false;
        });
      }
    } else {
      propValidators.set(key, context.compileNodeCheck(propNode, formatRegistry, graph, lookupSchema));
    }
  }

  const allowedKeys = sem.properties.size > 0 ? new Set(sem.properties.keys()) : undefined;
  const required = sem.required.length > 0 ? sem.required : undefined;
  const additionalPropertiesNode = sem.additionalPropertiesNode;
  const minProperties = sem.minProperties;
  const maxProperties = sem.maxProperties;

  let patternChecks: Array<{ 'check': CheckFnType;
    'regex': RegExp; }> | undefined;

  if (sem.patternPropertyEntries.length > 0) {
    patternChecks = [];

    for (const [
      pat,
      patNode
    ] of sem.patternPropertyEntries) {
      patternChecks.push({
        'check': context.compileNodeOrBooleanCheck(patNode, formatRegistry, graph, lookupSchema),
        'regex': new RegExp(pat, 'u')
      });
    }
  }

  let additionalCheck: CheckFnType | undefined;

  const hasAdditionalSchemaNode = additionalPropertiesNode !== undefined
    && additionalPropertiesNode !== true
    && additionalPropertiesNode !== false;

  if (hasAdditionalSchemaNode) {
    additionalCheck = context.compileNodeOrBooleanCheck(
      additionalPropertiesNode,
      formatRegistry,
      graph,
      lookupSchema
    );
  }

  const additionalIsFalse = additionalPropertiesNode === false;

  return (value) => {
    if (!isRecord(value)) {
      return true;
    }

    if (required !== undefined) {
      for (const key of required) {
        if (!(key in value)) {
          return false;
        }
      }
    }

    if (minProperties !== undefined || maxProperties !== undefined) {
      const count = Object.keys(value).length;

      if (minProperties !== undefined && count < minProperties) {
        return false;
      }
      if (maxProperties !== undefined && count > maxProperties) {
        return false;
      }
    }

    for (const key of Object.keys(value)) {
      const propCheck = propValidators.get(key);

      if (propCheck !== undefined) {
        if (!propCheck(value[key])) {
          return false;
        }
        continue;
      }

      if (patternChecks !== undefined) {
        let matchedPattern = false;

        for (const pc of patternChecks) {
          if (pc.regex.test(key)) {
            matchedPattern = true;
            if (!pc.check(value[key])) {
              return false;
            }
          }
        }
        if (matchedPattern) {
          continue;
        }
      }

      if (additionalIsFalse) {
        if (allowedKeys?.has(key) !== true) {
          return false;
        }
      } else if (additionalCheck !== undefined && !additionalCheck(value[key])) {
        return false;
      }
    }

    return true;
  };
}

export function compileRefCheck(
  context: SchemaCompilerGraphContextInterface,
  ref: string,
  formatRegistry: FormatRegistryInterface,
  graph: SchemaGraphInterface,
  lookupSchema?: (id: string) => Record<string, unknown> | undefined,
  lookupGraph?: (id: string) => SchemaGraphInterface | undefined
): CheckFnType | undefined {
  // Fast path: cross-schema root ref with a pre-compiled entry
  if (!ref.startsWith('#')) {
    const hashIndex = ref.indexOf('#');
    const schemaId = hashIndex === -1 ? ref : ref.slice(0, hashIndex);
    const fragment = hashIndex === -1 ? '' : ref.slice(hashIndex + 1);

    if ((fragment === '' || fragment === '/') && context.lookupCompiled !== undefined) {
      const { lookupCompiled } = context;

      return (value) => {
        const compiled = lookupCompiled(schemaId);

        return compiled === undefined ? true : compiled.check(value);
      };
    }
  }

  const resolved = RefResolver.resolve(ref, graph, lookupSchema, lookupGraph);

  if (resolved === undefined) {
    return undefined;
  }

  const {
    'graph': targetGraph, 'node': targetNode
  } = resolved;

  if (typeof targetNode.schema === 'boolean') {
    return targetNode.schema
      ? () => {
        return true;
      }
      : () => {
        return false;
      };
  }

  if (targetGraph === graph && context.compilingNodes.has(targetNode)) {
    let cachedCheck: CheckFnType | undefined;

    return (value) => {
      cachedCheck ??= context.compileNodeCheck(targetNode, formatRegistry, targetGraph, lookupSchema);

      return cachedCheck(value);
    };
  }

  return context.compileNodeCheck(targetNode, formatRegistry, targetGraph, lookupSchema);
}

export function nodeSupportsCompilation(
  node: SchemaGraphNodeInterface,
  graph: SchemaGraphInterface,
  lookupSchema: ((id: string) => Record<string, unknown> | undefined) | undefined,
  visited: Set<SchemaGraphNodeInterface | string>,
  lookupGraph?: (id: string) => SchemaGraphInterface | undefined
): boolean {
  if (visited.has(node)) {
    return true;
  }
  visited.add(node);

  const sem = graph.semantics(node);

  if (sem.dynamicRef !== undefined || sem.dynamicAnchor !== undefined) {
    return false;
  }
  if (sem.unevaluatedPropertiesNode !== undefined || sem.unevaluatedItemsNode !== undefined) {
    return false;
  }
  if (sem.rdfsRange !== undefined || sem.rdfsDomain !== undefined) {
    return false;
  }

  if (sem.ref !== undefined) {
    if (sem.refTargetNode === undefined) {
      const hashIndex = sem.ref.indexOf('#');
      const schemaId = hashIndex === -1 ? sem.ref : sem.ref.slice(0, hashIndex);

      if (visited.has(schemaId)) {
        return true;
      }
      visited.add(schemaId);

      const refGraph = lookupGraph?.(schemaId) ?? ((): SchemaGraphInterface | undefined => {
        const refSchema = lookupSchema?.(schemaId);

        return refSchema === undefined ? undefined : new SchemaGraph(refSchema);
      })();

      if (refGraph !== undefined) {
        const refRootSupported = nodeSupportsCompilation(
          refGraph.rootNode,
          refGraph,
          lookupSchema,
          visited,
          lookupGraph
        );

        if (!refRootSupported) {
          return false;
        }
      }
    } else {
      const refTargetSupported = nodeSupportsCompilation(
        sem.refTargetNode,
        graph,
        lookupSchema,
        visited,
        lookupGraph
      );

      if (!refTargetSupported) {
        return false;
      }
    }
  }

  for (const branch of [
    ...sem.allOf,
    ...sem.anyOf,
    ...sem.oneOf
  ]) {
    if (!nodeSupportsCompilation(branch, graph, lookupSchema, visited, lookupGraph)) {
      return false;
    }
  }

  for (const child of [
    sem.complementNode,
    sem.ifNode,
    sem.thenNode,
    sem.elseNode
  ]) {
    if (child !== undefined
      && !nodeSupportsCompilation(child, graph, lookupSchema, visited, lookupGraph)) {
      return false;
    }
  }

  for (const [
    ,
    propNode
  ] of sem.properties) {
    if (!nodeSupportsCompilation(propNode, graph, lookupSchema, visited, lookupGraph)) {
      return false;
    }
  }

  if (
    sem.itemsNode !== undefined
    && !nodeSupportsCompilation(sem.itemsNode, graph, lookupSchema, visited, lookupGraph)
  ) {
    return false;
  }

  if (sem.additionalPropertiesNode !== undefined && typeof sem.additionalPropertiesNode !== 'boolean') {
    const addlSupported = nodeSupportsCompilation(
      sem.additionalPropertiesNode,
      graph,
      lookupSchema,
      visited,
      lookupGraph
    );

    if (!addlSupported) {
      return false;
    }
  }

  return true;
}

export function tryCompileFlatObjectCheck(
  context: SchemaCompilerGraphContextInterface,
  graphNode: SchemaGraphNodeInterface,
  formatRegistry: FormatRegistryInterface,
  graph: SchemaGraphInterface,
  lookupSchema?: (id: string) => Record<string, unknown> | undefined
): CheckFnType | undefined {
  const sem = graph.semantics(graphNode);

  if (!canUseFlatObjectFastPath(context, sem)) {
    return undefined;
  }

  const propChecks = buildFlatObjectPropertyChecks(context, sem, formatRegistry, graph, lookupSchema);
  const rejectsAdditional = sem.additionalPropertiesNode === false;
  const propNameSet = new Set(sem.properties.keys());

  return (value: unknown): boolean => {
    if (!isRecord(value)) {
      return false;
    }
    const obj = value;

    for (const pc of propChecks) {
      const val = obj[pc.name];

      if (val === undefined && !(pc.name in obj)) {
        if (pc.required) {
          return false;
        }
        continue;
      }
      if (!pc.check(val)) {
        return false;
      }
    }

    if (rejectsAdditional) {
      for (const key of Object.keys(obj)) {
        if (!propNameSet.has(key)) {
          return false;
        }
      }
    }

    return true;
  };
}

// ---------------------------------------------------------------------------
// Plan-time helpers (validate context)
// ---------------------------------------------------------------------------

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
  propertyEntries: ReadonlyMap<string, SchemaGraphNodeInterface>,
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
  lookupSchema?: (id: string) => Record<string, unknown> | undefined,
  lookupGraph?: (id: string) => SchemaGraphInterface | undefined
): undefined | ValidateWithErrorsFnType {
  if (typeof ref !== 'string') {
    return undefined;
  }

  const resolved = RefResolver.resolve(ref, graph, lookupSchema, lookupGraph);

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
  propertyEntries: ReadonlyMap<string, SchemaGraphNodeInterface>,
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
  propertyEntries: ReadonlyMap<string, SchemaGraphNodeInterface>,
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

// ---------------------------------------------------------------------------
// buildNodePlan — single keyword traversal → CompiledNodeValidationPlanInterface
// ---------------------------------------------------------------------------

export function buildNodePlan(
  context: SchemaCompilerValidatePlanContextInterface,
  graphNode: SchemaGraphNodeInterface,
  formatRegistry: FormatRegistryInterface,
  graph: SchemaGraphInterface,
  lookupSchema?: (id: string) => Record<string, unknown> | undefined,
  lookupGraph?: (id: string) => SchemaGraphInterface | undefined
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
    'refValidator': compileRefValidator(context, sem.ref, formatRegistry, graph, lookupSchema, lookupGraph),
    'required': sem.required.length > 0 ? sem.required : undefined,
    thenValidator,
    'types': sem.schemaTypes,
    'uniqueItems': sem.uniqueItems
  };
}
