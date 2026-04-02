import type { ValidationErrorType } from '../../../types/Validation.js';
import type { VisitFnType } from '../../../types/VisitFn.js';
import type { EffectiveOptionsType } from '../../../types/EffectiveOptions.js';
import type { SchemaGraphNodeInterface } from '../../../interfaces/SchemaGraph.js';
import type { SchemaGraphInterface } from '../../../interfaces/SchemaGraphImpl.js';
import type { CompositionAccumulatorInterface } from '../../../interfaces/CompositionAccumulator.js';
import type { DynamicScopeEntryInterface } from '../../../interfaces/DynamicScopeEntry.js';
import type { InternalExecutionResultInterface } from '../../../interfaces/InternalExecutionResult.js';
import type { VisitContextInterface } from '../../../interfaces/VisitContext.js';
import {
  cloneCandidate
} from '../GraphEngineSupport.js';

export class VisitComposition {
  static allOf(
    context: VisitContextInterface,
    allOf: SchemaGraphNodeInterface[],
    graph: SchemaGraphInterface,
    acc: CompositionAccumulatorInterface,
    path: string,
    options: EffectiveOptionsType,
    refStack: Set<string>,
    dynScope: DynamicScopeEntryInterface[],
    depth: number,
    visitNode: VisitFnType,
    pushErrors: (errors: ValidationErrorType[]) => void
  ): InternalExecutionResultInterface | undefined {
    for (const childNode of allOf) {
      const branch = visitNode(context, childNode, graph, acc.value, path, options, refStack, dynScope, depth + 1);

      if (!branch.valid && !options.collectErrors) {
        return branch;
      }
      pushErrors(branch.errors);
      acc.value = branch.value;
      for (const key of branch.evaluatedProperties) {
        acc.evaluatedProperties.add(key);
      }
      for (const index of branch.evaluatedItems) {
        acc.evaluatedItems.add(index);
      }
    }

    return undefined;
  }

  static anyOf(
    context: VisitContextInterface,
    anyOf: SchemaGraphNodeInterface[],
    graph: SchemaGraphInterface,
    acc: CompositionAccumulatorInterface,
    path: string,
    options: EffectiveOptionsType,
    refStack: Set<string>,
    dynScope: DynamicScopeEntryInterface[],
    depth: number,
    visitNode: VisitFnType,
    invalid: (error: ValidationErrorType) => InternalExecutionResultInterface
  ): InternalExecutionResultInterface | undefined {
    const successfulResults: InternalExecutionResultInterface[] = [];

    for (const childNode of anyOf) {
      const candidate = visitNode(context, childNode, graph, cloneCandidate(acc.value), path, {
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

    acc.value = successfulResults[0].value;
    for (const successful of successfulResults) {
      for (const key of successful.evaluatedProperties) {
        acc.evaluatedProperties.add(key);
      }
      for (const index of successful.evaluatedItems) {
        acc.evaluatedItems.add(index);
      }
    }

    return undefined;
  }

  static ifThenElse(
    context: VisitContextInterface,
    ifNode: SchemaGraphNodeInterface,
    thenNode: SchemaGraphNodeInterface | undefined,
    elseNode: SchemaGraphNodeInterface | undefined,
    graph: SchemaGraphInterface,
    acc: CompositionAccumulatorInterface,
    path: string,
    options: EffectiveOptionsType,
    refStack: Set<string>,
    dynScope: DynamicScopeEntryInterface[],
    depth: number,
    visitNode: VisitFnType,
    pushErrors: (errors: ValidationErrorType[]) => void
  ): InternalExecutionResultInterface | undefined {
    const condition = visitNode(context, ifNode, graph, cloneCandidate(acc.value), path, {
      ...options,
      'collectErrors': true
    }, refStack, dynScope, depth + 1);
    const branchNode = condition.valid ? thenNode : elseNode;

    for (const key of condition.evaluatedProperties) {
      acc.evaluatedProperties.add(key);
    }
    for (const index of condition.evaluatedItems) {
      acc.evaluatedItems.add(index);
    }

    if (branchNode !== undefined) {
      const branch = visitNode(context, branchNode, graph, acc.value, path, options, refStack, dynScope, depth + 1);

      if (!branch.valid && !options.collectErrors) {
        return branch;
      }
      pushErrors(branch.errors);
      acc.value = branch.value;
      for (const key of branch.evaluatedProperties) {
        acc.evaluatedProperties.add(key);
      }
      for (const index of branch.evaluatedItems) {
        acc.evaluatedItems.add(index);
      }
    }

    return undefined;
  }

  static not(
    context: VisitContextInterface,
    complementNode: SchemaGraphNodeInterface,
    graph: SchemaGraphInterface,
    workingValue: unknown,
    path: string,
    options: EffectiveOptionsType,
    refStack: Set<string>,
    dynScope: DynamicScopeEntryInterface[],
    depth: number,
    visitNode: VisitFnType,
    invalid: (error: ValidationErrorType) => InternalExecutionResultInterface
  ): InternalExecutionResultInterface | undefined {
    const notResult = visitNode(context, complementNode, graph, cloneCandidate(workingValue), path, {
      ...options,
      'collectErrors': true
    }, refStack, dynScope, depth + 1);

    if (notResult.valid) {
      return invalid(context.createError(path, 'not', 'must not match schema'));
    }

    return undefined;
  }

  static oneOf(
    context: VisitContextInterface,
    oneOf: SchemaGraphNodeInterface[],
    graph: SchemaGraphInterface,
    acc: CompositionAccumulatorInterface,
    path: string,
    options: EffectiveOptionsType,
    refStack: Set<string>,
    dynScope: DynamicScopeEntryInterface[],
    depth: number,
    visitNode: VisitFnType,
    invalid: (error: ValidationErrorType) => InternalExecutionResultInterface,
    discriminatorPropertyName: string | undefined,
    discriminatorMapping: Record<string, string> | undefined
  ): InternalExecutionResultInterface | undefined {
    let matches = 0;
    let matchedResult: InternalExecutionResultInterface | undefined;

    const discProp = discriminatorPropertyName;
    let discriminatorHandled = false;

    if (
      discProp !== undefined
      && typeof acc.value === 'object'
      && acc.value !== null
      && !Array.isArray(acc.value)
    ) {
      const dataObj = acc.value as Record<string, unknown>;
      const discValue = dataObj[discProp];

      if (discValue !== undefined && typeof discValue === 'string') {
        const variantCache = oneOf.map((child) => {
          return {
            'node': child,
            'sem': graph.semantics(child)
          };
        });

        const mapping = discriminatorMapping;

        if (mapping !== undefined && discValue in mapping) {
          const targetRef = mapping[discValue];

          for (const variant of variantCache) {
            if (variant.sem.ref === targetRef) {
              const candidate = visitNode(context, variant.node, graph, cloneCandidate(acc.value), path, {
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

        if (!discriminatorHandled) {
          for (const variant of variantCache) {
            const discPropNode = variant.sem.properties.get(discProp);

            if (discPropNode !== undefined) {
              const discPropSemantics = graph.semantics(discPropNode);

              if (discPropSemantics.hasConst && discPropSemantics.constValue === discValue) {
                const candidate = visitNode(context, variant.node, graph, cloneCandidate(acc.value), path, {
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
        const candidate = visitNode(context, oneOfChild, graph, cloneCandidate(acc.value), path, {
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
      acc.value = matchedResult.value;
      for (const key of matchedResult.evaluatedProperties) {
        acc.evaluatedProperties.add(key);
      }
      for (const index of matchedResult.evaluatedItems) {
        acc.evaluatedItems.add(index);
      }
    }

    return undefined;
  }
}
