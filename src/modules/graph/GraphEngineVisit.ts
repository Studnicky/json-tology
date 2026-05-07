import type { ValidationErrorType } from '../../types/Validation.js';
import type { SchemaGraphNodeInterface } from '../../interfaces/SchemaGraph.js';
import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphImpl.js';
import {
  isRecord
} from '../data/DataTypes.js';
import { Predicates } from '../validation/Predicates.js';
import {
  cloneDefault
} from './GraphEngineSupport.js';
import type { EffectiveOptionsType } from '../../types/EffectiveOptions.js';
import type { DynamicScopeEntryInterface } from '../../interfaces/DynamicScopeEntry.js';
import type { InternalExecutionResultInterface } from '../../interfaces/InternalExecutionResult.js';
import type { VisitContextInterface } from '../../interfaces/VisitContext.js';
import { GraphError } from '../../errors/GraphError.js';
import { Refs } from './visit/Refs.js';
import { VisitComposition } from './visit/VisitComposition.js';
import { Unevaluated } from './visit/Unevaluated.js';

export function visitNode(
  context: VisitContextInterface,
  node: SchemaGraphNodeInterface,
  graph: SchemaGraphInterface,
  value: unknown,
  path: string,
  options: EffectiveOptionsType,
  refStack: Set<string>,
  dynamicScope: DynamicScopeEntryInterface[],
  depth = 0
): InternalExecutionResultInterface {
  if (depth > options.maxSchemaDepth) {
    throw new GraphError('RECURSION_LIMIT', `Maximum schema recursion depth (${options.maxSchemaDepth}) exceeded at path: ${path}`, path);
  }

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
        'errors': [context.createError(path, 'falseSchema', 'must not match false schema')],
        'evaluatedItems': new Set(),
        'evaluatedProperties': new Set(),
        'valid': false,
        value
      };
  }

  let workingValue = value;

  const sem = graph.semantics(node);
  const {
    allOf,
    anyOf,
    'complementNode': complementNode,
    'constValue': rawConstValue,
    'defaultValue': rawDefaultValue,
    discriminatorMapping,
    discriminatorPropertyName,
    dynamicAnchor,
    dynamicRef,
    elseNode,
    enumValues,
    extensions,
    hasConst,
    hasDefault,
    ifNode,
    oneOf,
    rdfsRange,
    ref,
    schemaTypes,
    thenNode,
    unevaluatedItemsNode,
    unevaluatedPropertiesNode
  } = sem;
  const constValue = hasConst ? rawConstValue : undefined;
  const defaultValue = hasDefault ? rawDefaultValue : undefined;

  if (workingValue === undefined && options.applyDefaults && defaultValue !== undefined) {
    workingValue = cloneDefault(defaultValue);
  }
  if (workingValue === undefined && options.synthesizeDefaults) {
    workingValue = context.synthesizeZeroValue(node, graph, dynamicScope);
  }
  if (options.castTypes) {
    workingValue = context.coerceValue(schemaTypes, workingValue, options.materializeContainers);
  }

  const dynScope = typeof dynamicAnchor === 'string'
    ? [
      ...dynamicScope,
      {
        'anchor': dynamicAnchor,
        graph,
        node
      }
    ]
    : dynamicScope;

  // --- $ref resolution ---
  if (typeof ref === 'string') {
    const refResult = Refs.resolveRef(
      context,
      ref,
      graph,
      workingValue,
      path,
      options,
      refStack,
      dynScope,
      depth,
      visitNode
    );

    if (!refResult.valid) {
      return refResult;
    }
    workingValue = refResult.value;
  }

  // --- $dynamicRef resolution ---
  if (typeof dynamicRef === 'string') {
    const dynResult = Refs.resolveDynamicRef(
      context,
      dynamicRef,
      graph,
      workingValue,
      path,
      options,
      refStack,
      dynScope,
      depth,
      visitNode
    );

    if (!dynResult.valid) {
      return dynResult;
    }
    workingValue = dynResult.value;
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

  // --- Scalar validation ---
  if (schemaTypes.length > 0 && !context.matchesType(schemaTypes, workingValue)) {
    return invalid(context.createError(
      path,
      'type',
      schemaTypes.length === 1 ? `must be ${schemaTypes[0]}` : `must be one of: ${schemaTypes.join(', ')}`,
      { 'type': schemaTypes }
    ));
  }

  if (enumValues !== undefined && !Predicates.satisfiesEnum(workingValue, enumValues)) {
    return invalid(context.createError(path, 'enum', 'must be one of the allowed values'));
  }

  if (constValue !== undefined && !Predicates.satisfiesConst(workingValue, constValue)) {
    return invalid(context.createError(path, 'const', `must be ${JSON.stringify(constValue)}`));
  }

  if (typeof workingValue === 'string') {
    const stringErrors = context.validateString(path, workingValue, sem);

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
    const numberErrors = context.validateNumber(path, workingValue, sem);

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

  // --- Array validation ---
  if (Array.isArray(workingValue)) {
    const arrayResult = context.validateArray(graph, workingValue, path, options, refStack, dynScope, sem, depth);

    if (!arrayResult.valid && !options.collectErrors) {
      return arrayResult;
    }
    workingValue = arrayResult.value;
    pushErrors(arrayResult.errors);
    for (const index of arrayResult.evaluatedItems) {
      evaluatedItems.add(index);
    }
  }

  // --- Object validation ---
  if (isRecord(workingValue)) {
    const objectResult = context.validateObject(node, graph, workingValue, path, options, refStack, dynScope, depth);

    if (!objectResult.valid && !options.collectErrors) {
      return objectResult;
    }
    workingValue = objectResult.value;
    pushErrors(objectResult.errors);
    for (const key of objectResult.evaluatedProperties) {
      evaluatedProperties.add(key);
    }
  }

  // --- Composition accumulator ---
  const acc = {
    evaluatedItems,
    evaluatedProperties,
    'value': workingValue
  };

  // --- allOf ---
  if (allOf.length > 0) {
    const earlyExit = VisitComposition.allOf(
      context,
      allOf,
      graph,
      acc,
      path,
      options,
      refStack,
      dynScope,
      depth,
      visitNode,
      pushErrors
    );

    if (earlyExit !== undefined) {
      return earlyExit;
    }
    workingValue = acc.value;
  }

  // --- anyOf ---
  if (anyOf.length > 0) {
    const earlyExit = VisitComposition.anyOf(
      context,
      anyOf,
      graph,
      acc,
      path,
      options,
      refStack,
      dynScope,
      depth,
      visitNode,
      invalid
    );

    if (earlyExit !== undefined) {
      return earlyExit;
    }
    workingValue = acc.value;
  }

  // --- oneOf ---
  if (oneOf.length > 0) {
    const earlyExit = VisitComposition.oneOf(
      context,
      oneOf,
      graph,
      acc,
      path,
      options,
      refStack,
      dynScope,
      depth,
      visitNode,
      invalid,
      discriminatorPropertyName,
      discriminatorMapping
    );

    if (earlyExit !== undefined) {
      return earlyExit;
    }
    workingValue = acc.value;
  }

  // --- not ---
  if (complementNode !== undefined) {
    const earlyExit = VisitComposition.not(
      context,
      complementNode,
      graph,
      workingValue,
      path,
      options,
      refStack,
      dynScope,
      depth,
      visitNode,
      invalid
    );

    if (earlyExit !== undefined) {
      return earlyExit;
    }
  }

  // --- if/then/else ---
  if (ifNode !== undefined) {
    const earlyExit = VisitComposition.ifThenElse(
      context,
      ifNode,
      thenNode,
      elseNode,
      graph,
      acc,
      path,
      options,
      refStack,
      dynScope,
      depth,
      visitNode,
      pushErrors
    );

    if (earlyExit !== undefined) {
      return earlyExit;
    }
    workingValue = acc.value;
  }

  // --- Unevaluated items ---
  if (Array.isArray(workingValue) && unevaluatedItemsNode !== undefined) {
    const unevaluatedResult = context.applyUnevaluatedItems(
      node,
      graph,
      workingValue,
      path,
      options,
      refStack,
      dynScope,
      evaluatedItems,
      depth
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

  // --- Unevaluated properties ---
  if (isRecord(workingValue) && unevaluatedPropertiesNode !== undefined) {
    const unevaluatedResult = context.applyUnevaluatedProperties(
      node,
      graph,
      workingValue,
      path,
      options,
      refStack,
      dynScope,
      evaluatedProperties,
      depth
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

  // --- Custom keywords ---
  const kwEarlyExit = Unevaluated.customKeywords(
    context,
    context.customKeywords,
    extensions,
    workingValue,
    path,
    options,
    errors,
    evaluatedItems,
    evaluatedProperties
  );

  if (kwEarlyExit !== undefined) {
    return kwEarlyExit;
  }

  // --- rdfs:range validation ---
  if (typeof rdfsRange === 'string') {
    Unevaluated.rdfsRange(context, rdfsRange, workingValue, path, options, refStack, depth, visitNode, pushErrors);
  }

  return {
    errors,
    evaluatedItems,
    evaluatedProperties,
    'valid': errors.length === 0,
    'value': workingValue
  };
}
