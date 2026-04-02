import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import type {
  CheckFnType, ValidateWithErrorsFnType, ValidationErrorType
} from '../../src/types/Validation.js';
import { Arrays } from '../../src/modules/validation/exec/Arrays.js';
import { BaseError } from '../../src/errors/BaseError.js';

const passing: ValidateWithErrorsFnType = ((value: unknown) => {
  return {
    'valid': true,
    value
  };
}) as ValidateWithErrorsFnType;
const failing: ValidateWithErrorsFnType = (value, path, errors, collectErrors) => {
  if (collectErrors) {
    errors.push(BaseError.validationError(path, 'type', 'mock'));
  }

  return {
    'valid': false,
    value
  };
};
const passingCheck: CheckFnType = () => {
  return true;
};
const failingCheck: CheckFnType = () => {
  return false;
};
const oneMatch: CheckFnType = (value) => {
  return value === 1;
};

void describe('Arrays', () => {
  void describe('validateBounds', () => {
    void it('returns valid when array is within bounds', () => {
      const result = Arrays.validateBounds('/a', [
        1,
        2,
        3
      ], 1, 5, false);

      assert.equal(result.valid, true);
      assert.equal(result.errors.length, 0);
    });

    void it('returns invalid when array is below minItems', () => {
      const result = Arrays.validateBounds('/a', [1], 3, undefined, false);

      assert.equal(result.valid, false);
      assert.equal(result.errors.length, 1);
      assert.equal(result.errors[0].keyword, 'minItems');
    });

    void it('returns invalid when array is above maxItems', () => {
      const result = Arrays.validateBounds('/a', [
        1,
        2,
        3,
        4
      ], undefined, 2, false);

      assert.equal(result.valid, false);
      assert.equal(result.errors.length, 1);
      assert.equal(result.errors[0].keyword, 'maxItems');
    });

    void it('returns invalid when uniqueItems is true and array has duplicates', () => {
      const result = Arrays.validateBounds('/a', [
        1,
        2,
        2,
        3
      ], undefined, undefined, true);

      assert.equal(result.valid, false);
      assert.equal(result.errors.length, 1);
      assert.equal(result.errors[0].keyword, 'uniqueItems');
    });

    void it('returns valid when uniqueItems is true and all items are unique', () => {
      const result = Arrays.validateBounds('/a', [
        1,
        2,
        3
      ], undefined, undefined, true);

      assert.equal(result.valid, true);
      assert.equal(result.errors.length, 0);
    });
  });

  void describe('validateContains', () => {
    void it('returns valid when containsCheck is undefined', () => {
      const result = Arrays.validateContains('/a', [
        1,
        2
      ]);

      assert.equal(result.valid, true);
      assert.equal(result.errors.length, 0);
    });

    void it('returns valid when at least one item matches', () => {
      const result = Arrays.validateContains('/a', [
        1,
        2,
        3
      ], passingCheck);

      assert.equal(result.valid, true);
      assert.equal(result.errors.length, 0);
    });

    void it('returns invalid when no item matches', () => {
      const result = Arrays.validateContains('/a', [
        1,
        2,
        3
      ], failingCheck);

      assert.equal(result.valid, false);
      assert.equal(result.errors.length, 1);
      assert.equal(result.errors[0].keyword, 'contains');
    });

    void it('returns invalid when match count is below minContains', () => {
      const result = Arrays.validateContains('/a', [
        1,
        2,
        3
      ], oneMatch, 2);

      assert.equal(result.valid, false);
      assert.equal(result.errors.length, 1);
      assert.match(result.errors[0].message, /at least 2/u);
    });

    void it('returns invalid when match count is above maxContains', () => {
      const result = Arrays.validateContains('/a', [
        1,
        2,
        3
      ], passingCheck, undefined, 2);

      assert.equal(result.valid, false);
      assert.equal(result.errors.length, 1);
      assert.match(result.errors[0].message, /at most 2/u);
    });
  });

  void describe('validateItems', () => {
    void it('returns valid when itemValidator is undefined', () => {
      const errors: ValidationErrorType[] = [];
      const result = Arrays.validateItems('/a', [
        1,
        2
      ], undefined, undefined, errors, false, false, false, false);

      assert.equal(result.valid, true);
      assert.equal(result.earlyExit, false);
    });

    void it('returns valid when all items pass', () => {
      const errors: ValidationErrorType[] = [];
      const result = Arrays.validateItems('/a', [
        1,
        2,
        3
      ], passing, undefined, errors, false, false, false, false);

      assert.equal(result.valid, true);
      assert.equal(result.earlyExit, false);
    });

    void it('returns earlyExit when item fails and collectErrors is false', () => {
      const errors: ValidationErrorType[] = [];
      const result = Arrays.validateItems('/a', [
        1,
        2
      ], failing, undefined, errors, false, false, false, false);

      assert.equal(result.valid, false);
      assert.equal(result.earlyExit, true);
    });

    void it('collects errors when item fails and collectErrors is true', () => {
      const errors: ValidationErrorType[] = [];
      const result = Arrays.validateItems('/a', [
        1,
        2
      ], failing, undefined, errors, true, false, false, false);

      assert.equal(result.valid, false);
      assert.equal(result.earlyExit, false);
      assert.equal(errors.length, 2);
    });

    void it('skips prefix items when prefixValidators are present', () => {
      const errors: ValidationErrorType[] = [];
      const arr = [
        1,
        2,
        3,
        4
      ];
      const prefixValidators = [
        passing,
        passing
      ];
      const result = Arrays.validateItems('/a', arr, passing, prefixValidators, errors, false, false, false, false);

      assert.equal(result.valid, true);
      assert.equal(result.earlyExit, false);
    });
  });

  void describe('validatePrefixItems', () => {
    void it('returns valid when prefixValidators is undefined', () => {
      const errors: ValidationErrorType[] = [];
      const result = Arrays.validatePrefixItems('/a', [
        1,
        2
      ], undefined, errors, false, false, false, false);

      assert.equal(result.valid, true);
      assert.equal(result.earlyExit, false);
    });

    void it('returns valid when all prefix items pass', () => {
      const errors: ValidationErrorType[] = [];
      const result = Arrays.validatePrefixItems('/a', [
        1,
        2,
        3
      ], [
        passing,
        passing
      ], errors, false, false, false, false);

      assert.equal(result.valid, true);
      assert.equal(result.earlyExit, false);
    });

    void it('returns earlyExit when prefix item fails and collectErrors is false', () => {
      const errors: ValidationErrorType[] = [];
      const result = Arrays.validatePrefixItems('/a', [
        1,
        2
      ], [
        failing,
        passing
      ], errors, false, false, false, false);

      assert.equal(result.valid, false);
      assert.equal(result.earlyExit, true);
    });

    void it('collects errors when prefix item fails and collectErrors is true', () => {
      const errors: ValidationErrorType[] = [];
      const result = Arrays.validatePrefixItems('/a', [
        1,
        2
      ], [
        failing,
        failing
      ], errors, true, false, false, false);

      assert.equal(result.valid, false);
      assert.equal(result.earlyExit, false);
      assert.equal(errors.length, 2);
    });
  });
});
