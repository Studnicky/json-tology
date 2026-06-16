import type { KeywordContextType } from '../../../types/GraphEngine.js';
import type {
  CheckFnType, ValidateWithErrorsFnType, ValidateWithErrorsResultType
} from '../../../types/Validation.js';
import type { ExecContextType } from '../../../types/ExecContext.js';
import type { CustomKeywordEntryType } from '../../../types/CustomKeywordEntry.js';
import { BaseError } from '../../../errors/BaseError.js';
import {
  isRecord
} from '../../data/DataTypes.js';
import { Predicates } from '../Predicates.js';
import { VALIDATION_MESSAGES } from '../../../constants/VALIDATION_MESSAGES.js';

/**
 * Composition — validation helpers for JSON Schema composition keywords.
 *
 * Implements `allOf`, `anyOf`, `oneOf`, `not`, `if/then/else`,
 * `dependentSchemas`, and custom keyword dispatch. All methods are pure
 * static and allocation-free on the hot path.
 *
 * @remarks
 * Called directly from compiled validator closures. Methods accept positional
 * parameters rather than options objects so V8 can maintain monomorphic call
 * sites and inline cache entries across the hot validation path.
 *
 * @category Validation
 * @since 0.1.0
 * @see {@link Objects}
 * @group exec
 *
 * @example
 * ```ts
 * const result = Composition.validateAllOf(value, path, validators, ctx);
 * ```
 */
export class Composition {
  private static applyAllOfMember(
    current: unknown,
    path: string,
    validator: ValidateWithErrorsFnType,
    ctx: ExecContextType
  ): ValidateWithErrorsResultType & { 'earlyExit': boolean } {
    // allOf members run with stripUnknown forced false — see comment in validateAllOf
    const memberCtx: ExecContextType = {
      ...ctx,
      'stripUnknown': false
    };
    const result = validator(current, path, memberCtx);

    // Propagate evaluated sets from the member ctx back to the outer ctx so that
    // unevaluatedProperties/unevaluatedItems post-passes see what the allOf branch
    // evaluated. Mirrors VisitComposition.allOf (VisitComposition.ts:60-70).
    if (memberCtx.evaluatedProperties !== undefined) {
      for (const key of memberCtx.evaluatedProperties) {
        (ctx.evaluatedProperties ??= new Set()).add(key);
      }
    }
    if (memberCtx.evaluatedItems !== undefined) {
      for (const index of memberCtx.evaluatedItems) {
        (ctx.evaluatedItems ??= new Set()).add(index);
      }
    }

    if (!result.valid && !ctx.collectErrors) {
      return {
        'earlyExit': true,
        'valid': false,
        'value': result.value
      };
    }

    return {
      'earlyExit': false,
      'valid': result.valid,
      'value': result.value
    };
  }

  private static applyDependentSchemaMember(
    current: unknown,
    path: string,
    validator: ValidateWithErrorsFnType,
    ctx: ExecContextType
  ): ValidateWithErrorsResultType & { 'earlyExit': boolean } {
    const result = validator(current, path, ctx);

    if (!result.valid && !ctx.collectErrors) {
      return {
        'earlyExit': true,
        'valid': false,
        'value': result.value
      };
    }

    return {
      'earlyExit': false,
      'valid': result.valid,
      'value': result.value
    };
  }

  private static applyElseBranch(
    workingValue: unknown,
    path: string,
    elseValidator: ValidateWithErrorsFnType,
    ctx: ExecContextType
  ): ValidateWithErrorsResultType & { 'earlyExit': boolean } {
    const branchCtx: ExecContextType = { ...ctx };
    const elseResult = elseValidator(workingValue, path, branchCtx);

    // Propagate evaluated sets from the else branch back to the outer ctx.
    // The else branch's compiled validator creates its own childCtx (via spread),
    // accumulates evaluated keys/indices onto that childCtx, and never writes
    // back to the caller — so explicit propagation is required here.
    if (branchCtx.evaluatedProperties !== undefined) {
      for (const key of branchCtx.evaluatedProperties) {
        (ctx.evaluatedProperties ??= new Set()).add(key);
      }
    }
    if (branchCtx.evaluatedItems !== undefined) {
      for (const index of branchCtx.evaluatedItems) {
        (ctx.evaluatedItems ??= new Set()).add(index);
      }
    }

    if (!elseResult.valid && !ctx.collectErrors) {
      return {
        'earlyExit': true,
        'valid': false,
        'value': elseResult.value
      };
    }

    return {
      'earlyExit': false,
      'valid': elseResult.valid,
      'value': elseResult.value
    };
  }

  private static applyThenBranch(
    workingValue: unknown,
    path: string,
    thenValidator: ValidateWithErrorsFnType,
    ctx: ExecContextType
  ): ValidateWithErrorsResultType & { 'earlyExit': boolean } {
    const branchCtx: ExecContextType = { ...ctx };
    const thenResult = thenValidator(workingValue, path, branchCtx);

    // Propagate evaluated sets from the then branch back to the outer ctx.
    // Mirror of applyElseBranch: branch validators create child contexts via spread;
    // evaluated sets are accumulated on the child and must be explicitly merged back.
    if (branchCtx.evaluatedProperties !== undefined) {
      for (const key of branchCtx.evaluatedProperties) {
        (ctx.evaluatedProperties ??= new Set()).add(key);
      }
    }
    if (branchCtx.evaluatedItems !== undefined) {
      for (const index of branchCtx.evaluatedItems) {
        (ctx.evaluatedItems ??= new Set()).add(index);
      }
    }

    if (!thenResult.valid && !ctx.collectErrors) {
      return {
        'earlyExit': true,
        'valid': false,
        'value': thenResult.value
      };
    }

    return {
      'earlyExit': false,
      'valid': thenResult.valid,
      'value': thenResult.value
    };
  }

  static validateAllOf(
    workingValue: unknown,
    path: string,
    allOfValidators: undefined | ValidateWithErrorsFnType[],
    ctx: ExecContextType
  ): { 'earlyExit': boolean;
    'valid': boolean;
    'value': unknown } {
    if (allOfValidators === undefined) {
      return {
        'earlyExit': false,
        'valid': true,
        'value': workingValue
      };
    }

    let valid = true;
    let current = workingValue;

    // Pre-pass: collect explicit property defaults from all branches before any
    // branch's required check runs. A required field in branch N whose default
    // lives in branch N+1 would otherwise fail the required check.
    // exec/* is the compiled backend; visit/* (VisitComposition) is the interpreter fallback.
    if (ctx.applyDefaults) {
      const preCtx: ExecContextType = {
        ...ctx,
        'collectErrors': true,
        'errors': [],
        'stripUnknown': false
      };

      for (const allOfValidator of allOfValidators) {
        current = allOfValidator(current, path, preCtx).value;
      }
    }

    // allOf members run with stripUnknown forced false: each member
    // sees only its own properties as "known" but the value carries
    // fields from all members, so per-member stripping would erase
    // legitimate values from sibling members. The top-level node's
    // validator performs the final strip against `allowedKeysForStrip`,
    // which is the union of own + allOf-inherited property names.
    for (const allOfValidator of allOfValidators) {
      const step = Composition.applyAllOfMember(current, path, allOfValidator, ctx);

      if (step.earlyExit) {
        return step;
      }
      if (!step.valid) {
        valid = false;
      }
      current = step.value;
    }

    return {
      'earlyExit': false,
      valid,
      'value': current
    };
  }

  static validateAnyOf(
    path: string,
    value: unknown,
    anyOfChecks: CheckFnType[] | undefined,
    errors: Array<ReturnType<typeof BaseError.validationError>>
  ): boolean {
    if (anyOfChecks === undefined) {
      return true;
    }

    const matched = anyOfChecks.some((check: CheckFnType) => {
      return check(value);
    });

    if (matched) {
      return true;
    }

    errors.push(BaseError.validationError(path, 'anyOf', VALIDATION_MESSAGES.anyOf));

    return false;
  }

  /**
   * anyOf with evaluated-set propagation.
   *
   * Runs each anyOf branch as a full validator in a child context. For every
   * branch that passes validation, its evaluated properties and evaluated items
   * are merged back into `ctx` so the post-pass `unevaluatedProperties` /
   * `unevaluatedItems` check sees the correct residual set.
   *
   * Mirrors `VisitComposition.anyOf` evaluated-set semantics (VisitComposition.ts:119-130).
   */
  static validateAnyOfWithEvaluated(
    path: string,
    value: unknown,
    anyOfValidators: ValidateWithErrorsFnType[],
    ctx: ExecContextType
  ): boolean {
    let matched = false;

    for (const validator of anyOfValidators) {
      const branchCtx: ExecContextType = {
        ...ctx,
        'collectErrors': true,
        'errors': []
      };
      const result = validator(value, path, branchCtx);

      if (result.valid) {
        matched = true;
        // Propagate evaluated sets from the passing branch to the parent ctx.
        if (branchCtx.evaluatedProperties !== undefined) {
          for (const key of branchCtx.evaluatedProperties) {
            (ctx.evaluatedProperties ??= new Set()).add(key);
          }
        }
        if (branchCtx.evaluatedItems !== undefined) {
          for (const index of branchCtx.evaluatedItems) {
            (ctx.evaluatedItems ??= new Set()).add(index);
          }
        }
      }
    }

    if (matched) {
      return true;
    }

    if (ctx.collectErrors) {
      ctx.errors.push(BaseError.validationError(path, 'anyOf', VALIDATION_MESSAGES.anyOf));
    }

    return false;
  }

  /**
   * Value-producing anyOf: runs full validators on cloned candidates, picks the first
   * winner's output value (matching VisitComposition.anyOf semantics).
   */
  static validateAnyOfWithValues(
    path: string,
    workingValue: unknown,
    anyOfValidators: ValidateWithErrorsFnType[],
    ctx: ExecContextType,
    cloneCandidate: <T>(v: T) => T
  ): { 'earlyExit': boolean;
    'valid': boolean;
    'value': unknown } {
    const branchCtx: ExecContextType = {
      ...ctx,
      'collectErrors': true,
      'errors': []
    };
    let winnerValue: unknown;
    let found = false;

    for (const validator of anyOfValidators) {
      const candidate = cloneCandidate(workingValue);
      const result = validator(candidate, path, branchCtx);

      if (result.valid && !found) {
        winnerValue = result.value;
        found = true;
      }
    }

    if (found) {
      return {
        'earlyExit': false,
        'valid': true,
        'value': winnerValue
      };
    }

    if (ctx.collectErrors) {
      ctx.errors.push(BaseError.validationError(path, 'anyOf', VALIDATION_MESSAGES.anyOf));
    }

    return {
      'earlyExit': !ctx.collectErrors,
      'valid': false,
      'value': workingValue
    };
  }

  static validateCustomKeywords(
    path: string,
    value: unknown,
    customKeywordEntries: CustomKeywordEntryType[] | undefined,
    errors: Array<ReturnType<typeof BaseError.validationError>>
  ): boolean {
    if (customKeywordEntries === undefined) {
      return true;
    }

    const dataType = Predicates.inferValueType(value);
    const pre = errors.length;

    for (const entry of customKeywordEntries) {
      if (entry.allowedTypes !== undefined && !entry.allowedTypes.includes(dataType)) {
        continue;
      }

      const ctx: KeywordContextType = {
        'parentData': undefined,
        'parentKey': '',
        path,
        'rootData': value
      };
      const kwResult = entry.validate(entry.schemaValue, value, ctx);

      if (kwResult === false) {
        errors.push(BaseError.validationError(path, entry.keyword, VALIDATION_MESSAGES.keyword(entry.keyword)));
      } else if (Array.isArray(kwResult) && kwResult.length > 0) {
        errors.push(...kwResult);
      }
    }

    return errors.length === pre;
  }

  static validateDependentSchemas(
    workingValue: unknown,
    path: string,
    depSchemaValidators: Array<{ 'trigger': string;
      'validator': ValidateWithErrorsFnType }> | undefined,
    ctx: ExecContextType
  ): { 'earlyExit': boolean;
    'valid': boolean;
    'value': unknown } {
    if (depSchemaValidators === undefined || !isRecord(workingValue)) {
      return {
        'earlyExit': false,
        'valid': true,
        'value': workingValue
      };
    }

    const obj = workingValue;
    let valid = true;
    let current = workingValue as unknown;

    for (const dep of depSchemaValidators) {
      if (dep.trigger in obj) {
        const step = Composition.applyDependentSchemaMember(current, path, dep.validator, ctx);

        if (step.earlyExit) {
          return step;
        }
        if (!step.valid) {
          valid = false;
        }
        current = step.value;
      }
    }

    return {
      'earlyExit': false,
      valid,
      'value': current
    };
  }

  static validateIfThenElse(
    workingValue: unknown,
    path: string,
    ifCheck: CheckFnType | undefined,
    thenValidator: undefined | ValidateWithErrorsFnType,
    elseValidator: undefined | ValidateWithErrorsFnType,
    ctx: ExecContextType
  ): { 'earlyExit': boolean;
    'valid': boolean;
    'value': unknown } {
    if (ifCheck === undefined) {
      return {
        'earlyExit': false,
        'valid': true,
        'value': workingValue
      };
    }

    if (ifCheck(workingValue)) {
      if (thenValidator !== undefined) {
        return Composition.applyThenBranch(workingValue, path, thenValidator, ctx);
      }
    } else if (elseValidator !== undefined) {
      return Composition.applyElseBranch(workingValue, path, elseValidator, ctx);
    }

    return {
      'earlyExit': false,
      'valid': true,
      'value': workingValue
    };
  }

  static validateNot(
    path: string,
    value: unknown,
    complementCheck: CheckFnType | undefined,
    errors: Array<ReturnType<typeof BaseError.validationError>>
  ): boolean {
    if (complementCheck?.(value) !== true) {
      return true;
    }

    errors.push(BaseError.validationError(path, 'not', VALIDATION_MESSAGES.not));

    return false;
  }

  static validateOneOf(
    path: string,
    value: unknown,
    oneOfChecks: CheckFnType[] | undefined,
    errors: Array<ReturnType<typeof BaseError.validationError>>
  ): boolean {
    if (oneOfChecks === undefined) {
      return true;
    }

    let count = 0;

    for (const check of oneOfChecks) {
      if (check(value)) {
        count++;
        if (count > 1) {
          break;
        }
      }
    }

    if (count === 1) {
      return true;
    }

    errors.push(BaseError.validationError(path, 'oneOf', VALIDATION_MESSAGES.oneOf, { 'matchCount': count }));

    return false;
  }

  /**
   * oneOf with evaluated-set propagation.
   *
   * Runs each oneOf branch as a full validator in a child context. If exactly
   * one branch passes, its evaluated properties and evaluated items are merged
   * back into `ctx` so the post-pass `unevaluatedProperties` / `unevaluatedItems`
   * check sees the correct residual set.
   *
   * Mirrors `VisitComposition.oneOf` evaluated-set semantics.
   */
  static validateOneOfWithEvaluated(
    path: string,
    value: unknown,
    oneOfValidators: ValidateWithErrorsFnType[],
    ctx: ExecContextType
  ): boolean {
    let count = 0;
    let winnerBranchCtx: ExecContextType | undefined;

    for (const validator of oneOfValidators) {
      const branchCtx: ExecContextType = {
        ...ctx,
        'collectErrors': true,
        'errors': []
      };
      const result = validator(value, path, branchCtx);

      if (result.valid) {
        count++;
        if (count === 1) {
          winnerBranchCtx = branchCtx;
        }
        if (count > 1) {
          break;
        }
      }
    }

    if (count === 1 && winnerBranchCtx !== undefined) {
      // Propagate evaluated sets from the unique passing branch to the parent ctx.
      if (winnerBranchCtx.evaluatedProperties !== undefined) {
        for (const key of winnerBranchCtx.evaluatedProperties) {
          (ctx.evaluatedProperties ??= new Set()).add(key);
        }
      }
      if (winnerBranchCtx.evaluatedItems !== undefined) {
        for (const index of winnerBranchCtx.evaluatedItems) {
          (ctx.evaluatedItems ??= new Set()).add(index);
        }
      }

      return true;
    }

    if (ctx.collectErrors) {
      ctx.errors.push(BaseError.validationError(path, 'oneOf', VALIDATION_MESSAGES.oneOf, { 'matchCount': count }));
    }

    return false;
  }

  /**
   * Value-producing oneOf: runs full validators on cloned candidates, ensures exactly
   * one wins, propagates that winner's output value (matching VisitComposition.oneOf semantics).
   */
  static validateOneOfWithValues(
    path: string,
    workingValue: unknown,
    oneOfValidators: ValidateWithErrorsFnType[],
    ctx: ExecContextType,
    cloneCandidate: <T>(v: T) => T
  ): { 'earlyExit': boolean;
    'valid': boolean;
    'value': unknown } {
    const branchCtx: ExecContextType = {
      ...ctx,
      'collectErrors': true,
      'errors': []
    };
    let matches = 0;
    let winnerValue: unknown = workingValue;

    for (const validator of oneOfValidators) {
      const candidate = cloneCandidate(workingValue);
      const result = validator(candidate, path, branchCtx);

      if (result.valid) {
        matches++;
        if (matches === 1) {
          winnerValue = result.value;
        }
      }
    }

    if (matches === 1) {
      return {
        'earlyExit': false,
        'valid': true,
        'value': winnerValue
      };
    }

    if (ctx.collectErrors) {
      ctx.errors.push(BaseError.validationError(path, 'oneOf', VALIDATION_MESSAGES.oneOf, { 'matchCount': matches }));
    }

    return {
      'earlyExit': !ctx.collectErrors,
      'valid': false,
      'value': workingValue
    };
  }
}
