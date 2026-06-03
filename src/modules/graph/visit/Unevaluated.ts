import type { ValidationErrorType } from '../../../types/Validation.js';
import type { VisitFnType } from '../../../types/VisitFn.js';
import type { EffectiveOptionsType } from '../../../types/EffectiveOptions.js';
import type {
  KeywordContextInterface, KeywordDefinitionInterface
} from '../../../interfaces/GraphEngine.js';
import type { VisitContextInterface } from '../../../interfaces/VisitContext.js';
import type { InternalExecutionResultInterface } from '../../../interfaces/InternalExecutionResult.js';
import {
  isRecord
} from '../../data/DataTypes.js';
import { Predicates } from '../../validation/Predicates.js';

/**
 * Visit a value against a range schema and push any errors via the callback.
 */
function visitRangeValue(
  context: VisitContextInterface,
  rangeSchema: Record<string, unknown>,
  item: unknown,
  itemPath: string,
  options: EffectiveOptionsType,
  refStack: Set<string>,
  depth: number,
  visitNode: VisitFnType,
  pushErrors: (errors: ValidationErrorType[]) => void
): void {
  const rangeGraph = context.graphFor(rangeSchema);
  const res = visitNode(context, rangeGraph.rootNode, rangeGraph, item, itemPath, options, refStack, [], depth + 1);

  if (!res.valid) {
    pushErrors(res.errors);
  }
}

/**
 * Unevaluated — handlers for custom-keyword and rdfs:range validation steps.
 *
 * @remarks
 * Provides two static methods consumed by `GraphEngineVisit` during schema
 * validation: `customKeywords` dispatches user-defined keyword validators, and
 * `rdfsRange` validates a value against the range schema declared on a property.
 *
 * @example
 * ```ts
 * const result = Unevaluated.customKeywords(ctx, kws, exts, value, path, opts, errors, items, props);
 * ```
 *
 * @category Graph
 * @since 0.1.0
 * @see {@link UnevaluatedInterface}
 * @group Graph
 */
export class Unevaluated {
  static customKeywords(
    context: VisitContextInterface,
    customKeywords: KeywordDefinitionInterface[],
    extensions: Record<string, unknown>,
    workingValue: unknown,
    path: string,
    options: EffectiveOptionsType,
    errors: ValidationErrorType[],
    evaluatedItems: Set<number> | undefined,
    evaluatedProperties: Set<string> | undefined
  ): InternalExecutionResultInterface | undefined {
    if (customKeywords.length === 0) {
      return undefined;
    }

    const dataType = Predicates.inferValueType(workingValue);

    for (const kw of customKeywords) {
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
      const kwResult = kw.validate(extensions[kw.keyword], workingValue, kwContext);

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

    return undefined;
  }

  static rdfsRange(
    context: VisitContextInterface,
    rdfsRange: string,
    workingValue: unknown,
    path: string,
    options: EffectiveOptionsType,
    refStack: Set<string>,
    depth: number,
    visitNode: VisitFnType,
    pushErrors: (errors: ValidationErrorType[]) => void
  ): void {
    if (options.lookupSchema === undefined) {
      return;
    }

    const rangeSchema = options.lookupSchema(rdfsRange);

    if (rangeSchema === undefined) {
      return;
    }

    const rangeRefKey = `rdfs:range::${rdfsRange}`;

    if (refStack.has(rangeRefKey)) {
      return;
    }

    refStack.add(rangeRefKey);

    if (isRecord(workingValue)) {
      visitRangeValue(context, rangeSchema, workingValue, path, options, refStack, depth, visitNode, pushErrors);
    } else if (Array.isArray(workingValue)) {
      for (const [
        i,
        item
      ] of workingValue.entries()) {
        if (isRecord(item) || Array.isArray(item)) {
          visitRangeValue(context, rangeSchema, item, `${path}/${i}`, options, refStack, depth, visitNode, pushErrors);
        }
      }
    }

    refStack.delete(rangeRefKey);
  }
}
