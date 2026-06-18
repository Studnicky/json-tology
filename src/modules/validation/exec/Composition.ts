import type { KeywordContextType } from '../../../types/GraphEngine.js';
import type {
  ValidateWithErrorsFnType, ValidateWithErrorsResultType
} from '../../../types/Validation.js';
import type { ExecContextType } from '../../../types/ExecContext.js';
import type { CustomKeywordEntryType } from '../../../types/CustomKeywordEntry.js';
import { BaseError } from '../../../errors/BaseError.js';
import {
  isRecord
} from '../../data/DataTypes.js';
import { GraphEngineSupport } from '../../graph/GraphEngineSupport.js';
import { Predicates } from '../../data/Predicates.js';
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
        'stripUnknown': false,
        'synthesizeDefaults': false
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

  /**
   * Unified anyOf validation.
   *
   * Runs each anyOf branch as a full validator in an isolated scratch context.
   * When `ctx.applyDefaults || ctx.doCoerce`, each branch gets a cloned candidate
   * value and the first passing branch's output is used. In check-mode (no value
   * production), branches run with collectErrors:false so they short-circuit on
   * first failure — cheap and avoids accumulating phantom errors.
   *
   * Evaluated sets from all passing branches are merged back into `ctx` for
   * `unevaluatedProperties` / `unevaluatedItems` post-pass correctness.
   */
  static validateAnyOf(
    path: string,
    value: unknown,
    anyOfValidators: undefined | ValidateWithErrorsFnType[],
    ctx: ExecContextType
  ): { 'earlyExit': boolean;
    'valid': boolean;
    'value': unknown } {
    if (anyOfValidators === undefined) {
      return {
        'earlyExit': false,
        'valid': true,
        'value': value
      };
    }

    const needsValueProducing = ctx.applyDefaults || ctx.doCoerce;
    let matched = false;
    let winnerValue: unknown = value;
    let winnerBranchCtx: ExecContextType | undefined;

    for (const validator of anyOfValidators) {
      if (needsValueProducing) {
        const candidate = GraphEngineSupport.cloneCandidate(value);
        const branchCtx: ExecContextType = {
          ...ctx,
          'collectErrors': true,
          'errors': [],
          'evaluatedItems': undefined,
          'evaluatedProperties': undefined
        };
        const result = validator(candidate, path, branchCtx);

        if (result.valid) {
          if (!matched) {
            matched = true;
            winnerValue = result.value;
            winnerBranchCtx = branchCtx;
          } else if (ctx.trackEvaluated) {
            // Merge evaluated sets from additional passing branches
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
      } else {
        // Check mode: run in isolated scratch ctx
        const branchCtx: ExecContextType = {
          ...ctx,
          'applyDefaults': false,
          'collectErrors': false,
          'doCoerce': false,
          'errors': [],
          'evaluatedItems': undefined,
          'evaluatedProperties': undefined,
          'stripUnknown': false
        };
        const result = validator(value, path, branchCtx);

        if (result.valid) {
          if (!matched) {
            matched = true;
            // Record first winner for post-loop merge when not tracking evaluated
            winnerBranchCtx = branchCtx;
          }

          if (ctx.trackEvaluated) {
            // Merge evaluated sets from ALL passing branches immediately
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
          } else {
            // In check mode without unevaluated tracking, break early
            break;
          }
        }
      }
    }

    if (matched) {
      // When NOT tracking evaluated, merge winner's sets now
      if (!ctx.trackEvaluated && winnerBranchCtx !== undefined) {
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
      }

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
      'value': value
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

  /**
   * Unified if/then/else validation.
   *
   * Runs `ifValidator` in an isolated check-mode scratch context to determine
   * the branch. The scratch context suppresses value production and error
   * collection so the branch test is a pure predicate that does not contaminate
   * the parent context's error list or output value.
   */
  static validateIfThenElse(
    workingValue: unknown,
    path: string,
    ifValidator: undefined | ValidateWithErrorsFnType,
    thenValidator: undefined | ValidateWithErrorsFnType,
    elseValidator: undefined | ValidateWithErrorsFnType,
    ctx: ExecContextType
  ): { 'earlyExit': boolean;
    'valid': boolean;
    'value': unknown } {
    if (ifValidator === undefined) {
      return {
        'earlyExit': false,
        'valid': true,
        'value': workingValue
      };
    }

    // Run if in isolated check-mode scratch ctx
    const ifScratchCtx: ExecContextType = {
      ...ctx,
      'applyDefaults': false,
      'collectErrors': false,
      'doCoerce': false,
      'errors': [],
      'evaluatedItems': undefined,
      'evaluatedProperties': undefined,
      'stripUnknown': false
    };
    const ifResult = ifValidator(workingValue, path, ifScratchCtx);

    if (ifResult.valid) {
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

  /**
   * Unified not validation.
   *
   * Runs `complementValidator` in an isolated check-mode scratch context.
   * The `not` keyword passes iff the inner validator FAILS — so we invert the result.
   */
  static validateNot(
    path: string,
    value: unknown,
    complementValidator: undefined | ValidateWithErrorsFnType,
    ctx: ExecContextType
  ): boolean {
    if (complementValidator === undefined) {
      return true;
    }

    // Run in isolated check-mode scratch ctx — not passes iff validator FAILS
    const scratchCtx: ExecContextType = {
      ...ctx,
      'applyDefaults': false,
      'collectErrors': false,
      'doCoerce': false,
      'errors': [],
      'evaluatedItems': undefined,
      'evaluatedProperties': undefined,
      'stripUnknown': false
    };
    const result = complementValidator(value, path, scratchCtx);

    if (result.valid) {
      // Complement validated — not fails
      if (ctx.collectErrors) {
        ctx.errors.push(BaseError.validationError(path, 'not', VALIDATION_MESSAGES.not));
      }

      return false;
    }

    return true;
  }

  /**
   * Unified oneOf validation.
   *
   * Runs each oneOf branch as a full validator in an isolated scratch context.
   * Exactly one branch must pass. When `ctx.applyDefaults || ctx.doCoerce`, each
   * branch gets a cloned candidate value and the unique winner's output is used.
   * In check-mode, branches run with collectErrors:false.
   *
   * Evaluated sets from the unique passing branch are merged back into `ctx`.
   */
  static validateOneOf(
    path: string,
    value: unknown,
    oneOfValidators: undefined | ValidateWithErrorsFnType[],
    ctx: ExecContextType
  ): { 'earlyExit': boolean;
    'valid': boolean;
    'value': unknown } {
    if (oneOfValidators === undefined) {
      return {
        'earlyExit': false,
        'valid': true,
        'value': value
      };
    }

    const needsValueProducing = ctx.applyDefaults || ctx.doCoerce;
    let matchCount = 0;
    let winnerValue: unknown = value;
    let winnerBranchCtx: ExecContextType | undefined;

    for (const validator of oneOfValidators) {
      const branchCtx: ExecContextType = needsValueProducing
        ? {
          ...ctx,
          'collectErrors': true,
          'errors': [],
          'evaluatedItems': undefined,
          'evaluatedProperties': undefined
        }
        : {
          ...ctx,
          'applyDefaults': false,
          'collectErrors': false,
          'doCoerce': false,
          'errors': [],
          'evaluatedItems': undefined,
          'evaluatedProperties': undefined,
          'stripUnknown': false
        };
      const candidate = needsValueProducing ? GraphEngineSupport.cloneCandidate(value) : value;
      const result = validator(candidate, path, branchCtx);

      if (result.valid) {
        matchCount++;

        if (matchCount === 1) {
          winnerValue = result.value;
          winnerBranchCtx = branchCtx;
        }

        if (matchCount > 1 && !ctx.collectErrors) {
          break;
        }
      }
    }

    if (matchCount === 1) {
      // Merge evaluated sets from winner into parent ctx
      if (ctx.trackEvaluated && winnerBranchCtx !== undefined) {
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
      }

      return {
        'earlyExit': false,
        'valid': true,
        'value': winnerValue
      };
    }

    if (ctx.collectErrors) {
      ctx.errors.push(BaseError.validationError(path, 'oneOf', VALIDATION_MESSAGES.oneOf, { 'matchCount': matchCount }));
    }

    return {
      'earlyExit': !ctx.collectErrors,
      'valid': false,
      'value': value
    };
  }
}
