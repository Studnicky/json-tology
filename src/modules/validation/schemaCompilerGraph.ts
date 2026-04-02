import type { CheckFnType } from '../../types/Validation.js';
import type { FormatRegistryInterface } from '../../interfaces/FormatRegistry.js';
import type { PropCheckInterface } from '../../interfaces/PropCheck.js';
import type { SchemaCompilerGraphContextInterface } from '../../interfaces/SchemaCompilerGraphContext.js';
import type {
  SchemaGraphNodeInterface, SchemaGraphSemanticsInterface
} from '../../interfaces/SchemaGraph.js';
import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphImpl.js';
import {
  deepEqual, isRecord
} from '../data/DataTypes.js';
import { SchemaGraph } from '../graph/SchemaGraph.js';
import { Predicates } from './predicates.js';
import { RefResolver } from './refResolver.js';

export function compileRefCheck(
  context: SchemaCompilerGraphContextInterface,
  ref: string,
  formatRegistry: FormatRegistryInterface,
  graph: SchemaGraphInterface,
  lookupSchema?: (id: string) => Record<string, unknown> | undefined
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

  const resolved = RefResolver.resolve(ref, graph, lookupSchema);

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
  visited: Set<SchemaGraphNodeInterface | string>
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
    if (sem.refTargetNode !== undefined) {
      if (!nodeSupportsCompilation(sem.refTargetNode, graph, lookupSchema, visited)) {
        return false;
      }
    } else if (lookupSchema !== undefined) {
      const hashIndex = sem.ref.indexOf('#');
      const schemaId = hashIndex === -1 ? sem.ref : sem.ref.slice(0, hashIndex);

      if (visited.has(schemaId)) {
        return true;
      }
      visited.add(schemaId);

      const refSchema = lookupSchema(schemaId);

      if (refSchema !== undefined) {
        const refGraph = new SchemaGraph(refSchema);

        if (!nodeSupportsCompilation(refGraph.rootNode, refGraph, lookupSchema, visited)) {
          return false;
        }
      }
    }
  }

  for (const branch of [
    ...sem.allOf,
    ...sem.anyOf,
    ...sem.oneOf
  ]) {
    if (!nodeSupportsCompilation(branch, graph, lookupSchema, visited)) {
      return false;
    }
  }

  for (const child of [
    sem.complementNode,
    sem.ifNode,
    sem.thenNode,
    sem.elseNode
  ]) {
    if (child !== undefined && !nodeSupportsCompilation(child, graph, lookupSchema, visited)) {
      return false;
    }
  }

  for (const [
    ,
    propNode
  ] of sem.properties) {
    if (!nodeSupportsCompilation(propNode, graph, lookupSchema, visited)) {
      return false;
    }
  }

  if (sem.itemsNode !== undefined && !nodeSupportsCompilation(sem.itemsNode, graph, lookupSchema, visited)) {
    return false;
  }

  if (sem.additionalPropertiesNode !== undefined
    && typeof sem.additionalPropertiesNode !== 'boolean'
    && !nodeSupportsCompilation(sem.additionalPropertiesNode, graph, lookupSchema, visited)) {
    return false;
  }

  return true;
}

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

  if (additionalPropertiesNode !== undefined
    && additionalPropertiesNode !== true
    && additionalPropertiesNode !== false) {
    additionalCheck = context.compileNodeOrBooleanCheck(additionalPropertiesNode, formatRegistry, graph, lookupSchema);
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
