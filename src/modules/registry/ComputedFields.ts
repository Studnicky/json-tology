/**
 * ComputedFields — shared execution logic for `jt:computed` handlers.
 *
 * Used by both SchemaRegistry.instantiate() and Materializer.materialize() so a
 * compute function throwing surfaces the same InstantiationError shape on either path.
 */

import type { ComputedFunctionInterface } from '../../interfaces/ComputedFunctionInterface.js';

import { BaseError } from '../../errors/BaseError.js';
import { InstantiationError } from '../../errors/InstantiationError.js';
import { ValidationErrors } from '../../errors/ValidationErrors.js';
import { INSTANTIATION_ERROR_CODE } from '../../constants/ERROR_CODES.js';

export class ComputedFields {
  public static assign(
    name: string,
    computeFunction: ComputedFunctionInterface,
    value: Record<string, unknown>
  ): void {
    try {
      value[name] = computeFunction(value);
    } catch (error) {
      const causeError = BaseError.toCause(error);

      throw new InstantiationError(
        new ValidationErrors([{
          'keyword': 'COMPUTED_FN_MISSING',
          'message': `Compute function for "${name}" threw: ${causeError.message}`,
          'params': {},
          'path': `/${name}`
        }]),
        {
          'cause': causeError,
          'code': INSTANTIATION_ERROR_CODE.INSTANTIATION_FAILED
        }
      );
    }
  }
}
