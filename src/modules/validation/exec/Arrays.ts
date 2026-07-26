import type { ValidateWithErrorsFunctionInterface } from '../../../interfaces/ValidateWithErrorsFunctionInterface.js';
import type { ExecContextInterface } from '../../../interfaces/ExecContextInterface.js';
import { BaseError } from '../../../errors/BaseError.js';
import { Predicates } from '../../data/Predicates.js';
import { VALIDATION_MESSAGES } from '../../../constants/VALIDATION_MESSAGES.js';

/**
 * Compiled array-item validation helpers shared by the {@link Arrays} exec methods.
 */
class SingleItem {
  static validate(
    validator: ValidateWithErrorsFunctionInterface,
    array: unknown[],
    index: number,
    path: string,
    context: ExecContextInterface
  ): 'early-exit' | 'invalid' | 'valid' {
    const childPath = `${path}/${index}`;
    const result = validator(array[index], childPath, context);

    if (result.value !== array[index]) {
      array[index] = result.value;
    }

    if (!result.valid) {
      return context.collectErrors ? 'invalid' : 'early-exit';
    }

    return 'valid';
  }
}

/**
 * `sh:contains`-style cardinality error message resolution for the compiled
 * `contains` keyword.
 */
class ContainsError {
  static resolve(
    count: number,
    minimumContains: number | undefined,
    maximumContains: number | undefined
  ): string | undefined {
    // Effective minimum: if minimumContains is absent, the default is 1 (JSON Schema spec).
    // Use the same `contains(n)` path as the interpreter (GraphEngine) for parity.
    const effectiveMinimum = minimumContains ?? 1;

    if (count < effectiveMinimum) {
      return VALIDATION_MESSAGES.contains(effectiveMinimum);
    }
    if (maximumContains !== undefined && count > maximumContains) {
      return VALIDATION_MESSAGES.maxContains(maximumContains);
    }

    return undefined;
  }
}

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
 * const ok = Arrays.validateBounds('/items', array, 1, 10, false, errors);
 * ```
 */
export class Arrays {
  static validateBounds(
    path: string,
    array: unknown[],
    minimumItems: number | undefined,
    maximumItems: number | undefined,
    uniqueItems: boolean,
    errors: Array<ReturnType<typeof BaseError.validationError>>
  ): boolean {
    const pre = errors.length;

    if (minimumItems !== undefined && array.length < minimumItems) {
      errors.push(BaseError.validationError(path, 'minItems', VALIDATION_MESSAGES.minItems(minimumItems)));
    }
    if (maximumItems !== undefined && array.length > maximumItems) {
      errors.push(BaseError.validationError(path, 'maxItems', VALIDATION_MESSAGES.maxItems(maximumItems)));
    }
    if (uniqueItems && !Predicates.satisfiesUniqueItems(array)) {
      errors.push(BaseError.validationError(path, 'uniqueItems', VALIDATION_MESSAGES.uniqueItems));
    }

    return errors.length === pre;
  }

  static validateContains(
    path: string,
    array: unknown[],
    containsValidator: undefined | ValidateWithErrorsFunctionInterface,
    minimumContains: number | undefined,
    maximumContains: number | undefined,
    context: ExecContextInterface,
    errors: Array<ReturnType<typeof BaseError.validationError>>
  ): boolean {
    if (containsValidator === undefined) {
      return true;
    }

    let count = 0;

    // Hoist scratch context outside the loop — check-mode (collectErrors:false) means no errors
    // are ever pushed, so the errors array is never mutated and can be shared across elements.
    // evaluatedItems/evaluatedProperties are reset to undefined since they are per-element.
    const scratchContext: ExecContextInterface = {
      ...context,
      'applyDefaults': false,
      'coerce': false,
      'collectErrors': false,
      'errors': [],
      'evaluatedItems': undefined,
      'evaluatedProperties': undefined,
      'stripUnknown': false,
      'synthesizeDefaults': false
    };

    for (const item of array) {
      // Reset per-element mutable scratch fields before each run.
      scratchContext.evaluatedItems = undefined;
      scratchContext.evaluatedProperties = undefined;
      const result = containsValidator(item, path, scratchContext);

      if (result.valid) {
        count++;
      }
    }

    const pre = errors.length;
    const containsError = ContainsError.resolve(count, minimumContains, maximumContains);

    if (containsError !== undefined) {
      errors.push(BaseError.validationError(path, 'contains', containsError));
    }

    return errors.length === pre;
  }

  static validateItems(
    path: string,
    array: unknown[],
    itemValidator: undefined | ValidateWithErrorsFunctionInterface,
    prefixValidators: undefined | ValidateWithErrorsFunctionInterface[],
    context: ExecContextInterface
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
    const arrayLength = array.length;

    for (let i = startIndex; i < arrayLength; i++) {
      const outcome = SingleItem.validate(itemValidator, array, i, path, context);

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
    array: unknown[],
    prefixValidators: undefined | ValidateWithErrorsFunctionInterface[],
    context: ExecContextInterface
  ): { 'earlyExit': boolean;
    'valid': boolean } {
    if (prefixValidators === undefined) {
      return {
        'earlyExit': false,
        'valid': true
      };
    }

    let valid = true;

    for (let i = 0; i < prefixValidators.length && i < array.length; i++) {
      const validator = prefixValidators[i];

      if (validator === undefined) {
        continue;
      }

      const outcome = SingleItem.validate(validator, array, i, path, context);

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
