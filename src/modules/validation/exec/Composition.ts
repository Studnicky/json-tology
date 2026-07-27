import type { KeywordContextInterface } from '../../../interfaces/KeywordContextInterface.js';
import type { ValidateWithErrorsFunctionInterface } from '../../../interfaces/ValidateWithErrorsFunctionInterface.js';
import type { ValidateWithErrorsResultEntity } from '../../../entities/ValidateWithErrorsResultEntity.js';
import type { ExecContextInterface } from '../../../interfaces/ExecContextInterface.js';
import type { CustomKeywordEntryInterface } from '../../../interfaces/CustomKeywordEntryInterface.js';
import { BaseError } from '../../../errors/BaseError.js';
import { DataType } from '../../data/DataType.js';
import { GraphEngineSupport } from '../../graph/GraphEngineSupport.js';
import { Predicates } from '../../data/Predicates.js';
import { VALIDATION_MESSAGES } from '../../../constants/VALIDATION_MESSAGES.js';

/**
 * Merges a branch/scratch context's accumulated `evaluatedProperties`/`evaluatedItems`
 * back into the parent context. Used everywhere a composition branch runs in its own
 * (spread-copied) context so `unevaluatedProperties`/`unevaluatedItems` post-passes on
 * the parent see what the branch evaluated.
 */
class EvaluatedMerge {
  static mergeInto(target: ExecContextInterface, source: ExecContextInterface): void {
    if (source.evaluatedProperties !== undefined) {
      for (const key of source.evaluatedProperties) {
        (target.evaluatedProperties ??= new Set()).add(key);
      }
    }
    if (source.evaluatedItems !== undefined) {
      for (const index of source.evaluatedItems) {
        (target.evaluatedItems ??= new Set()).add(index);
      }
    }
  }
}

/** Tags a validator result as early-exit when it fails and the caller isn't collecting errors. */
class BranchOutcome {
  static from(
    result: ValidateWithErrorsResultEntity.Type,
    collectErrors: boolean
  ): ValidateWithErrorsResultEntity.Type & { 'earlyExit': boolean } {
    if (!result.valid && !collectErrors) {
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
}

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
 * const result = Composition.validateAllOf(value, path, validators, context);
 * ```
 */
export class Composition {
  private static applyAllOfMember(
    current: unknown,
    path: string,
    validator: ValidateWithErrorsFunctionInterface,
    context: ExecContextInterface
  ): ValidateWithErrorsResultEntity.Type & { 'earlyExit': boolean } {
    // allOf members run with stripUnknown forced false — see comment in validateAllOf
    const memberContext: ExecContextInterface = {
      ...context,
      'stripUnknown': false
    };
    const result = validator(current, path, memberContext);

    // Mirrors VisitComposition.allOf (VisitComposition.ts:60-70).
    EvaluatedMerge.mergeInto(context, memberContext);

    return BranchOutcome.from(result, context.collectErrors);
  }

  private static applyBranch(
    workingValue: unknown,
    path: string,
    validator: ValidateWithErrorsFunctionInterface,
    context: ExecContextInterface
  ): ValidateWithErrorsResultEntity.Type & { 'earlyExit': boolean } {
    // The then/else branch's compiled validator creates its own childCtx (via spread),
    // accumulates evaluated keys/indices onto that childCtx, and never writes back to
    // the caller — so explicit propagation is required here.
    const branchContext: ExecContextInterface = { ...context };
    const result = validator(workingValue, path, branchContext);

    EvaluatedMerge.mergeInto(context, branchContext);

    return BranchOutcome.from(result, context.collectErrors);
  }

  private static applyDependentSchemaMember(
    current: unknown,
    path: string,
    validator: ValidateWithErrorsFunctionInterface,
    context: ExecContextInterface
  ): ValidateWithErrorsResultEntity.Type & { 'earlyExit': boolean } {
    const result = validator(current, path, context);

    return BranchOutcome.from(result, context.collectErrors);
  }

  static validateAllOf(
    workingValue: unknown,
    path: string,
    allOfValidators: undefined | ValidateWithErrorsFunctionInterface[],
    context: ExecContextInterface
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
    if (context.applyDefaults) {
      const preContext: ExecContextInterface = {
        ...context,
        'collectErrors': true,
        'errors': [],
        'stripUnknown': false,
        'synthesizeDefaults': false
      };

      for (const allOfValidator of allOfValidators) {
        current = allOfValidator(current, path, preContext).value;
      }
    }

    // allOf members run with stripUnknown forced false: each member
    // sees only its own properties as "known" but the value carries
    // fields from all members, so per-member stripping would erase
    // legitimate values from sibling members. The top-level node's
    // validator performs the final strip against `allowedKeysForStrip`,
    // which is the union of own + allOf-inherited property names.
    for (const allOfValidator of allOfValidators) {
      const step = Composition.applyAllOfMember(current, path, allOfValidator, context);

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
   * When `context.applyDefaults || context.coerce`, each branch gets a cloned candidate
   * value and the first passing branch's output is used. In check-mode (no value
   * production), branches run with collectErrors:false so they short-circuit on
   * first failure — cheap and avoids accumulating phantom errors.
   *
   * Evaluated sets from all passing branches are merged back into `context` for
   * `unevaluatedProperties` / `unevaluatedItems` post-pass correctness.
   */
  static validateAnyOf(
    path: string,
    value: unknown,
    anyOfValidators: undefined | ValidateWithErrorsFunctionInterface[],
    context: ExecContextInterface
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

    const needsValueProducing = context.applyDefaults || context.coerce;
    let matched = false;
    let winnerValue: unknown = value;
    let winnerBranchContext: ExecContextInterface | undefined;

    for (const validator of anyOfValidators) {
      if (needsValueProducing) {
        const candidate = GraphEngineSupport.cloneCandidate(value);
        const branchContext: ExecContextInterface = {
          ...context,
          'collectErrors': true,
          'errors': [],
          'evaluatedItems': undefined,
          'evaluatedProperties': undefined
        };
        const result = validator(candidate, path, branchContext);

        if (result.valid) {
          if (!matched) {
            matched = true;
            winnerValue = result.value;
            winnerBranchContext = branchContext;
          } else if (context.trackEvaluated) {
            // Merge evaluated sets from additional passing branches
            EvaluatedMerge.mergeInto(context, branchContext);
          }
        }
      } else {
        // Check mode: run in isolated scratch context
        const branchContext: ExecContextInterface = {
          ...context,
          'applyDefaults': false,
          'coerce': false,
          'collectErrors': false,
          'errors': [],
          'evaluatedItems': undefined,
          'evaluatedProperties': undefined,
          'stripUnknown': false
        };
        const result = validator(value, path, branchContext);

        if (result.valid) {
          if (!matched) {
            matched = true;
            // Record first winner for post-loop merge when not tracking evaluated
            winnerBranchContext = branchContext;
          }

          if (context.trackEvaluated) {
            // Merge evaluated sets from ALL passing branches immediately
            EvaluatedMerge.mergeInto(context, branchContext);
          } else {
            // In check mode without unevaluated tracking, break early
            break;
          }
        }
      }
    }

    if (matched) {
      // When NOT tracking evaluated, merge winner's sets now
      if (!context.trackEvaluated && winnerBranchContext !== undefined) {
        EvaluatedMerge.mergeInto(context, winnerBranchContext);
      }

      return {
        'earlyExit': false,
        'valid': true,
        'value': winnerValue
      };
    }

    if (context.collectErrors) {
      context.errors.push(BaseError.validationError(path, 'anyOf', VALIDATION_MESSAGES.anyOf));
    }

    return {
      'earlyExit': !context.collectErrors,
      'valid': false,
      'value': value
    };
  }

  static validateCustomKeywords(
    path: string,
    value: unknown,
    customKeywordEntries: CustomKeywordEntryInterface[] | undefined,
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

      const context: KeywordContextInterface = {
        'parentData': undefined,
        'parentKey': '',
        path,
        'rootData': value
      };
      const kwResult = entry.validate(entry.schemaValue, value, context);

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
      'validator': ValidateWithErrorsFunctionInterface }> | undefined,
    context: ExecContextInterface
  ): { 'earlyExit': boolean;
    'valid': boolean;
    'value': unknown } {
    if (depSchemaValidators === undefined || !DataType.isRecord(workingValue)) {
      return {
        'earlyExit': false,
        'valid': true,
        'value': workingValue
      };
    }

    const object = workingValue;
    let valid = true;
    let current = workingValue as unknown;

    for (const dep of depSchemaValidators) {
      if (dep.trigger in object) {
        const step = Composition.applyDependentSchemaMember(current, path, dep.validator, context);

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
    ifValidator: undefined | ValidateWithErrorsFunctionInterface,
    thenValidator: undefined | ValidateWithErrorsFunctionInterface,
    elseValidator: undefined | ValidateWithErrorsFunctionInterface,
    context: ExecContextInterface
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

    // Run if in isolated check-mode scratch context
    const ifScratchContext: ExecContextInterface = {
      ...context,
      'applyDefaults': false,
      'coerce': false,
      'collectErrors': false,
      'errors': [],
      'evaluatedItems': undefined,
      'evaluatedProperties': undefined,
      'stripUnknown': false
    };
    const ifResult = ifValidator(workingValue, path, ifScratchContext);

    if (ifResult.valid) {
      if (thenValidator !== undefined) {
        return Composition.applyBranch(workingValue, path, thenValidator, context);
      }
    } else if (elseValidator !== undefined) {
      return Composition.applyBranch(workingValue, path, elseValidator, context);
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
    complementValidator: undefined | ValidateWithErrorsFunctionInterface,
    context: ExecContextInterface
  ): boolean {
    if (complementValidator === undefined) {
      return true;
    }

    // Run in isolated check-mode scratch context — not passes iff validator FAILS
    const scratchContext: ExecContextInterface = {
      ...context,
      'applyDefaults': false,
      'coerce': false,
      'collectErrors': false,
      'errors': [],
      'evaluatedItems': undefined,
      'evaluatedProperties': undefined,
      'stripUnknown': false
    };
    const result = complementValidator(value, path, scratchContext);

    if (result.valid) {
      // Complement validated — not fails
      if (context.collectErrors) {
        context.errors.push(BaseError.validationError(path, 'not', VALIDATION_MESSAGES.not));
      }

      return false;
    }

    return true;
  }

  /**
   * Unified oneOf validation.
   *
   * Runs each oneOf branch as a full validator in an isolated scratch context.
   * Exactly one branch must pass. When `context.applyDefaults || context.coerce`, each
   * branch gets a cloned candidate value and the unique winner's output is used.
   * In check-mode, branches run with collectErrors:false.
   *
   * Evaluated sets from the unique passing branch are merged back into `context`.
   */
  static validateOneOf(
    path: string,
    value: unknown,
    oneOfValidators: undefined | ValidateWithErrorsFunctionInterface[],
    context: ExecContextInterface
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

    const needsValueProducing = context.applyDefaults || context.coerce;
    let matchCount = 0;
    let winnerValue: unknown = value;
    let winnerBranchContext: ExecContextInterface | undefined;

    for (const validator of oneOfValidators) {
      const branchContext: ExecContextInterface = needsValueProducing
        ? {
          ...context,
          'collectErrors': true,
          'errors': [],
          'evaluatedItems': undefined,
          'evaluatedProperties': undefined
        }
        : {
          ...context,
          'applyDefaults': false,
          'coerce': false,
          'collectErrors': false,
          'errors': [],
          'evaluatedItems': undefined,
          'evaluatedProperties': undefined,
          'stripUnknown': false
        };
      const candidate = needsValueProducing ? GraphEngineSupport.cloneCandidate(value) : value;
      const result = validator(candidate, path, branchContext);

      if (result.valid) {
        matchCount++;

        if (matchCount === 1) {
          winnerValue = result.value;
          winnerBranchContext = branchContext;
        }

        if (matchCount > 1 && !context.collectErrors) {
          break;
        }
      }
    }

    if (matchCount === 1) {
      // Merge evaluated sets from winner into parent context
      if (context.trackEvaluated && winnerBranchContext !== undefined) {
        EvaluatedMerge.mergeInto(context, winnerBranchContext);
      }

      return {
        'earlyExit': false,
        'valid': true,
        'value': winnerValue
      };
    }

    if (context.collectErrors) {
      context.errors.push(BaseError.validationError(path, 'oneOf', VALIDATION_MESSAGES.oneOf, { 'matchCount': matchCount }));
    }

    return {
      'earlyExit': !context.collectErrors,
      'valid': false,
      'value': value
    };
  }
}
