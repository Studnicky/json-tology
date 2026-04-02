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
} from '../../data/dataTypes.js';
import { Predicates } from '../../validation/predicates.js';

export class Unevaluated {
  static customKeywords(
    context: VisitContextInterface,
    customKeywords: KeywordDefinitionInterface[],
    extensions: Record<string, unknown>,
    workingValue: unknown,
    path: string,
    options: EffectiveOptionsType,
    errors: ValidationErrorType[],
    evaluatedItems: Set<number>,
    evaluatedProperties: Set<string>
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
        if (isRecord(item) || Array.isArray(item)) {
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
