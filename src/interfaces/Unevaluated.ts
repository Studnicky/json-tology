/**
 * UnevaluatedInterface — static contract for Unevaluated.
 *
 * Captures the public static surface of Unevaluated as a named type so that
 * consumers can depend on the interface rather than the concrete class.
 */

import type { ValidationErrorType } from '../types/Validation.js';
import type { VisitFnType } from '../types/VisitFn.js';
import type { EffectiveOptionsType } from '../types/EffectiveOptions.js';
import type {
  KeywordDefinitionInterface
} from '../interfaces/GraphEngine.js';
import type { VisitContextInterface } from '../interfaces/VisitContext.js';
import type { InternalExecutionResultInterface } from '../interfaces/InternalExecutionResult.js';

export interface UnevaluatedInterface {
  customKeywords(
    context: VisitContextInterface,
    customKeywords: KeywordDefinitionInterface[],
    extensions: Record<string, unknown>,
    workingValue: unknown,
    path: string,
    options: EffectiveOptionsType,
    errors: ValidationErrorType[],
    evaluatedItems: Set<number>,
    evaluatedProperties: Set<string>
  ): InternalExecutionResultInterface | undefined;

  rdfsRange(
    context: VisitContextInterface,
    rdfsRange: string,
    workingValue: unknown,
    path: string,
    options: EffectiveOptionsType,
    refStack: Set<string>,
    depth: number,
    visitNode: VisitFnType,
    pushErrors: (errors: ValidationErrorType[]) => void
  ): void;
}
