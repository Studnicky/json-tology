import type { ValidateWithErrorsFnType } from '../../../types/Validation.js';
import type { ExecContextType } from '../../../types/ExecContext.js';
import { BaseError } from '../../../errors/BaseError.js';
import { Predicates } from '../../data/Predicates.js';
import { VALIDATION_MESSAGES } from '../../../constants/VALIDATION_MESSAGES.js';

/**
 * Compiled array-keyword validators used by the hot-path schema executor.
 *
 * All methods mutate the caller-supplied `errors` array in place and return
 * a boolean indicating whether validation passed. This avoids per-call
 * allocations on the hot validation path.
 *
 * @remarks
 * Called directly from closures compiled by {@link SchemaCompiler}. Signatures
 * are intentionally flat (no options objects) to keep V8 call-site shapes
 * monomorphic and avoid hidden-class transitions.
 *
 * @category Validation
 * @since 0.1.0
 * @see {@link SchemaCompiler}
 * @group Internal
 * @example
 * ```ts
 * const ok = Arrays.validateBounds('/items', arr, 1, 10, false, errors);
 * ```
 */
export class Arrays {
  static validateBounds(
    path: string,
    arr: unknown[],
    minItems: number | undefined,
    maxItems: number | undefined,
    uniqueItems: boolean,
    errors: Array<ReturnType<typeof BaseError.validationError>>
  ): boolean {
    const pre = errors.length;

    if (minItems !== undefined && arr.length < minItems) {
      errors.push(BaseError.validationError(path, 'minItems', VALIDATION_MESSAGES.minItems(minItems)));
    }
    if (maxItems !== undefined && arr.length > maxItems) {
      errors.push(BaseError.validationError(path, 'maxItems', VALIDATION_MESSAGES.maxItems(maxItems)));
    }
    if (uniqueItems && !Predicates.satisfiesUniqueItems(arr)) {
      errors.push(BaseError.validationError(path, 'uniqueItems', VALIDATION_MESSAGES.uniqueItems));
    }

    return errors.length === pre;
  }

  static validateContains(
    path: string,
    arr: unknown[],
    containsValidator: undefined | ValidateWithErrorsFnType,
    minContains: number | undefined,
    maxContains: number | undefined,
    ctx: ExecContextType,
    errors: Array<ReturnType<typeof BaseError.validationError>>
  ): boolean {
    if (containsValidator === undefined) {
      return true;
    }

    let count = 0;

    // Hoist scratch ctx outside the loop — check-mode (collectErrors:false) means no errors
    // are ever pushed, so the errors array is never mutated and can be shared across elements.
    // evaluatedItems/evaluatedProperties are reset to undefined since they are per-element.
    const scratchCtx: ExecContextType = {
      ...ctx,
      'applyDefaults': false,
      'collectErrors': false,
      'doCoerce': false,
      'errors': [],
      'evaluatedItems': undefined,
      'evaluatedProperties': undefined,
      'stripUnknown': false,
      'synthesizeDefaults': false
    };

    for (const item of arr) {
      // Reset per-element mutable scratch fields before each run.
      scratchCtx.evaluatedItems = undefined;
      scratchCtx.evaluatedProperties = undefined;
      const result = containsValidator(item, path, scratchCtx);

      if (result.valid) {
        count++;
      }
    }

    const pre = errors.length;
    const containsError = resolveContainsError(count, minContains, maxContains);

    if (containsError !== undefined) {
      errors.push(BaseError.validationError(path, 'contains', containsError));
    }

    return errors.length === pre;
  }

  static validateItems(
    path: string,
    arr: unknown[],
    itemValidator: undefined | ValidateWithErrorsFnType,
    prefixValidators: undefined | ValidateWithErrorsFnType[],
    ctx: ExecContextType
  ): { 'earlyExit': boolean;
    'valid': boolean } {
    if (itemValidator === undefined) {
      return {
        'earlyExit': false,
        'valid': true
      };
    }

    const startIndex = prefixValidators === undefined ? 0 : prefixValidators.length;
    let valid = true;

    for (let i = startIndex; i < arr.length; i++) {
      const outcome = validateSingleItem(itemValidator, arr, i, path, ctx);

      if (outcome === 'early-exit') {
        return {
          'earlyExit': true,
          'valid': false
        };
      }
      if (outcome === 'invalid') {
        valid = false;
      }
    }

    return {
      'earlyExit': false,
      valid
    };
  }

  static validatePrefixItems(
    path: string,
    arr: unknown[],
    prefixValidators: undefined | ValidateWithErrorsFnType[],
    ctx: ExecContextType
  ): { 'earlyExit': boolean;
    'valid': boolean } {
    if (prefixValidators === undefined) {
      return {
        'earlyExit': false,
        'valid': true
      };
    }

    let valid = true;

    for (let i = 0; i < prefixValidators.length && i < arr.length; i++) {
      const outcome = validateSingleItem(prefixValidators[i], arr, i, path, ctx);

      if (outcome === 'early-exit') {
        return {
          'earlyExit': true,
          'valid': false
        };
      }
      if (outcome === 'invalid') {
        valid = false;
      }
    }

    return {
      'earlyExit': false,
      valid
    };
  }
}

function resolveContainsError(
  count: number,
  minContains: number | undefined,
  maxContains: number | undefined
): string | undefined {
  // Effective minimum: if minContains is absent, the default is 1 (JSON Schema spec).
  // Use the same `contains(n)` path as the interpreter (GraphEngine) for parity.
  const effectiveMin = minContains ?? 1;

  if (count < effectiveMin) {
    return VALIDATION_MESSAGES.contains(effectiveMin);
  }
  if (maxContains !== undefined && count > maxContains) {
    return VALIDATION_MESSAGES.maxContains(maxContains);
  }

  return undefined;
}

function validateSingleItem(
  validator: ValidateWithErrorsFnType,
  arr: unknown[],
  index: number,
  path: string,
  ctx: ExecContextType
): 'early-exit' | 'invalid' | 'valid' {
  const childPath = `${path}/${index}`;
  const result = validator(arr[index], childPath, ctx);

  if (result.value !== arr[index]) {
    arr[index] = result.value;
  }

  if (!result.valid) {
    return ctx.collectErrors ? 'invalid' : 'early-exit';
  }

  return 'valid';
}
