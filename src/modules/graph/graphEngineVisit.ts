import type { ValidationErrorType } from '../../types/Validation.js';
import type { KeywordContextInterface } from '../../interfaces/GraphEngine.js';
import type { SchemaGraphNodeInterface } from '../../interfaces/SchemaGraph.js';
import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphImpl.js';
import {
  isRecord
} from '../data/dataTypes.js';
import { Predicates } from '../validation/predicates.js';
import {
  cloneCandidate,
  cloneDefault,
  schemaId
} from './graphEngineSupport.js';
import type { EffectiveOptionsType } from '../../types/EffectiveOptions.js';
import type {
  DynamicScopeEntryInterface,
  InternalExecutionResultInterface
} from './graphEngineSupport.js';
import type { VisitContextInterface } from '../../interfaces/VisitContext.js';
import { GraphError } from '../../errors/GraphError.js';

export type { VisitContextInterface } from '../../interfaces/VisitContext.js';

const isObject = isRecord;

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
  if (depth > options.maxDepth) {
    throw new GraphError('RECURSION_LIMIT', `Maximum schema recursion depth (${options.maxDepth}) exceeded at path: ${path}`, path);
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

  if (typeof ref === 'string') {
    const refKey = `${schemaId(graph.rootSchema) ?? '<anonymous>'}::${ref}`;

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
    const resolved = context.resolveRef(ref, graph);
    const resolvedResult = visitNode(
      context,
      resolved.node,
      resolved.graph,
      workingValue,
      path,
      options,
      refStack,
      dynScope,
      depth + 1
    );

    refStack.delete(refKey);
    if (!resolvedResult.valid) {
      return resolvedResult;
    }
    workingValue = resolvedResult.value;
  }

  if (typeof dynamicRef === 'string') {
    const refKey = `${schemaId(graph.rootSchema) ?? '<anonymous>'}::dynamic::${dynamicRef}`;

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
    const resolved = context.resolveDynamicRef(dynamicRef, graph, dynScope);
    const resolvedResult = visitNode(
      context,
      resolved.node,
      resolved.graph,
      workingValue,
      path,
      options,
      refStack,
      dynScope,
      depth + 1
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

  if (isObject(workingValue)) {
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

  if (allOf.length > 0) {
    for (const childNode of allOf) {
      const branch = visitNode(context, childNode, graph, workingValue, path, options, refStack, dynScope, depth + 1);

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

  if (anyOf.length > 0) {
    const successfulResults: InternalExecutionResultInterface[] = [];

    for (const childNode of anyOf) {
      const candidate = visitNode(context, childNode, graph, cloneCandidate(workingValue), path, {
        ...options,
        'collectErrors': true
      }, refStack, dynScope, depth + 1);

      if (candidate.valid) {
        successfulResults.push(candidate);
      }
    }

    if (successfulResults.length === 0) {
      return invalid(context.createError(path, 'anyOf', 'must match at least one schema'));
    }

    const matchedResult = successfulResults[0];

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

  if (oneOf.length > 0) {
    let matches = 0;
    let matchedResult: InternalExecutionResultInterface | undefined;

    // Discriminator optimization: if the schema has a discriminator property,
    // check the discriminator value first and only validate against the matching variant.
    const discProp = discriminatorPropertyName;
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
        const variantCache = oneOf.map((child) => {
          return {
            'node': child,
            'sem': graph.semantics(child)
          };
        });

        // Mapping-based dispatch: discriminator.mapping maps discriminator values to $ref targets.
        const mapping = discriminatorMapping;

        if (mapping !== undefined && discValue in mapping) {
          const targetRef = mapping[discValue];

          for (const variant of variantCache) {
            if (variant.sem.ref === targetRef) {
              const candidate = visitNode(context, variant.node, graph, cloneCandidate(workingValue), path, {
                ...options,
                'collectErrors': true
              }, refStack, dynScope, depth + 1);

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
                const candidate = visitNode(context, variant.node, graph, cloneCandidate(workingValue), path, {
                  ...options,
                  'collectErrors': true
                }, refStack, dynScope, depth + 1);

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
      for (const oneOfChild of oneOf) {
        const candidate = visitNode(context, oneOfChild, graph, cloneCandidate(workingValue), path, {
          ...options,
          'collectErrors': true
        }, refStack, dynScope, depth + 1);

        if (candidate.valid) {
          matches++;
          matchedResult = candidate;
        }
      }
    }

    if (matches !== 1) {
      return invalid(context.createError(path, 'oneOf', 'must match exactly one schema'));
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

  if (complementNode !== undefined) {
    const notResult = visitNode(context, complementNode, graph, cloneCandidate(workingValue), path, {
      ...options,
      'collectErrors': true
    }, refStack, dynScope, depth + 1);

    if (notResult.valid) {
      return invalid(context.createError(path, 'not', 'must not match schema'));
    }
  }

  if (ifNode !== undefined) {
    const condition = visitNode(context, ifNode, graph, cloneCandidate(workingValue), path, {
      ...options,
      'collectErrors': true
    }, refStack, dynScope, depth + 1);
    const branchNode = condition.valid ? thenNode : elseNode;

    // Properties evaluated by the if condition count as evaluated (JSON Schema 2020-12 §10.2.2.1)
    for (const key of condition.evaluatedProperties) {
      evaluatedProperties.add(key);
    }
    for (const index of condition.evaluatedItems) {
      evaluatedItems.add(index);
    }

    if (branchNode !== undefined) {
      const branch = visitNode(context, branchNode, graph, workingValue, path, options, refStack, dynScope, depth + 1);

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

  if (isObject(workingValue) && unevaluatedPropertiesNode !== undefined) {
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

  // Custom keywords read from graph-owned extensions, not raw schema objects.
  if (context.customKeywords.length > 0) {
    const dataType = Predicates.inferValueType(workingValue);

    for (const kw of context.customKeywords) {
      if (!(kw.keyword in extensions)) {
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
        extensions[kw.keyword],
        workingValue,
        kwContext
      );

      if (kwResult === false) {
        const kwError = context.createError(path, kw.keyword, `must pass "${kw.keyword}" validation`);

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
  if (typeof rdfsRange === 'string' && options.lookupSchema !== undefined) {
    const rangeSchema = options.lookupSchema(rdfsRange);

    if (rangeSchema !== undefined) {
      const rangeRefKey = `rdfs:range::${rdfsRange}`;

      if (!refStack.has(rangeRefKey)) {
        refStack.add(rangeRefKey);

        if (isObject(workingValue)) {
          const rangeGraph = context.graphFor(rangeSchema);
          const rangeRoot = rangeGraph.rootNode;
          const res = visitNode(context, rangeRoot, rangeGraph, workingValue, path, options, refStack, [], depth + 1);

          if (!res.valid) {
            pushErrors(res.errors);
          }
        } else if (Array.isArray(workingValue)) {
          const rangeGraph = context.graphFor(rangeSchema);
          const rangeRoot = rangeGraph.rootNode;

          for (const [
            i,
            item
          ] of workingValue.entries()) {
            if (isObject(item) || Array.isArray(item)) {
              const itemPath = `${path}/${i}`;
              const res = visitNode(context, rangeRoot, rangeGraph, item, itemPath, options, refStack, [], depth + 1);

              if (!res.valid) {
                pushErrors(res.errors);
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
