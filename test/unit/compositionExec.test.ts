import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { Composition } from '../../src/modules/validation/exec/composition.js';
import type { ValidationErrorType } from '../../src/types/Validation.js';
import type { ValidateWithErrorsFnType } from '../../src/types/Validation.js';
import type { CheckFnType } from '../../src/types/Validation.js';
import type { CustomKeywordEntryInterface } from '../../src/interfaces/CustomKeywordEntry.js';

function passingValidator(): ValidateWithErrorsFnType {
  return ((value: unknown) => {
    return {
      'valid': true,
      'value': value
    };
  }) as ValidateWithErrorsFnType;
}

function failingValidator(): ValidateWithErrorsFnType {
  return ((value: unknown, path: string, errors: ValidationErrorType[]) => {
    errors.push({
      'instancePath': path,
      'keyword': 'type',
      'message': 'mock failure',
      'params': {}
    } as unknown as ValidationErrorType);

    return {
      'valid': false,
      'value': value
    };
  }) as ValidateWithErrorsFnType;
}

const alwaysTrue: CheckFnType = (_: unknown): boolean => {
  return true;
};

const alwaysFalse: CheckFnType = (_: unknown): boolean => {
  return false;
};

void describe('Composition', () => {
  void describe('validateAllOf', () => {
    void it('returns valid when validators is undefined', () => {
      const errors: ValidationErrorType[] = [];
      const result = Composition.validateAllOf('test', '', undefined, errors, true, false, false, false);

      assert.equal(result.valid, true);
      assert.equal(result.earlyExit, false);
      assert.equal(result.value, 'test');
    });

    void it('returns valid when all pass', () => {
      const errors: ValidationErrorType[] = [];
      const validators = [
        passingValidator(),
        passingValidator()
      ];
      const result = Composition.validateAllOf('test', '', validators, errors, true, false, false, false);

      assert.equal(result.valid, true);
      assert.equal(result.earlyExit, false);
    });

    void it('returns earlyExit when one fails with collectErrors false', () => {
      const errors: ValidationErrorType[] = [];
      const validators = [
        passingValidator(),
        failingValidator()
      ];
      const result = Composition.validateAllOf('test', '/root', validators, errors, false, false, false, false);

      assert.equal(result.valid, false);
      assert.equal(result.earlyExit, true);
    });

    void it('collects errors when one fails with collectErrors true', () => {
      const errors: ValidationErrorType[] = [];
      const validators = [
        passingValidator(),
        failingValidator()
      ];
      const result = Composition.validateAllOf('test', '/root', validators, errors, true, false, false, false);

      assert.equal(result.valid, false);
      assert.equal(result.earlyExit, false);
      assert.equal(errors.length, 1);
    });
  });

  void describe('validateAnyOf', () => {
    void it('returns valid when checks is undefined', () => {
      const result = Composition.validateAnyOf('', 'test');

      assert.equal(result.valid, true);
      assert.equal(result.error, undefined);
    });

    void it('returns valid when one matches', () => {
      const checks: CheckFnType[] = [
        alwaysFalse,
        alwaysTrue
      ];
      const result = Composition.validateAnyOf('', 'test', checks);

      assert.equal(result.valid, true);
      assert.equal(result.error, undefined);
    });

    void it('returns invalid with error when none match', () => {
      const checks: CheckFnType[] = [
        alwaysFalse,
        alwaysFalse
      ];
      const result = Composition.validateAnyOf('/root', 'test', checks);

      assert.equal(result.valid, false);
      assert.notEqual(result.error, undefined);
    });
  });

  void describe('validateOneOf', () => {
    void it('returns valid when checks is undefined', () => {
      const result = Composition.validateOneOf('', 'test');

      assert.equal(result.valid, true);
      assert.equal(result.error, undefined);
    });

    void it('returns valid when exactly one matches', () => {
      const checks: CheckFnType[] = [
        alwaysFalse,
        alwaysTrue,
        alwaysFalse
      ];
      const result = Composition.validateOneOf('', 'test', checks);

      assert.equal(result.valid, true);
      assert.equal(result.error, undefined);
    });

    void it('returns invalid when zero match', () => {
      const checks: CheckFnType[] = [
        alwaysFalse,
        alwaysFalse
      ];
      const result = Composition.validateOneOf('/root', 'test', checks);

      assert.equal(result.valid, false);
      assert.notEqual(result.error, undefined);
    });

    void it('returns invalid when multiple match', () => {
      const checks: CheckFnType[] = [
        alwaysTrue,
        alwaysTrue
      ];
      const result = Composition.validateOneOf('/root', 'test', checks);

      assert.equal(result.valid, false);
      assert.notEqual(result.error, undefined);
    });
  });

  void describe('validateNot', () => {
    void it('returns valid when check is undefined', () => {
      const result = Composition.validateNot('', 'test');

      assert.equal(result.valid, true);
      assert.equal(result.error, undefined);
    });

    void it('returns valid when complement fails (value passes not)', () => {
      const result = Composition.validateNot('', 'test', alwaysFalse);

      assert.equal(result.valid, true);
      assert.equal(result.error, undefined);
    });

    void it('returns invalid when complement passes (value fails not)', () => {
      const result = Composition.validateNot('/root', 'test', alwaysTrue);

      assert.equal(result.valid, false);
      assert.notEqual(result.error, undefined);
    });
  });

  void describe('validateIfThenElse', () => {
    void it('returns valid when ifCheck is undefined', () => {
      const errors: ValidationErrorType[] = [];
      const result = Composition.validateIfThenElse('test', '', undefined, undefined, undefined, errors, true, false, false, false);

      assert.equal(result.valid, true);
      assert.equal(result.value, 'test');
    });

    void it('returns valid when if true and then passes', () => {
      const errors: ValidationErrorType[] = [];
      const result = Composition.validateIfThenElse('test', '', alwaysTrue, passingValidator(), undefined, errors, true, false, false, false);

      assert.equal(result.valid, true);
    });

    void it('returns invalid when if true and then fails', () => {
      const errors: ValidationErrorType[] = [];
      const result = Composition.validateIfThenElse('test', '/root', alwaysTrue, failingValidator(), undefined, errors, true, false, false, false);

      assert.equal(result.valid, false);
    });

    void it('returns valid when if false and else passes', () => {
      const errors: ValidationErrorType[] = [];
      const result = Composition.validateIfThenElse('test', '', alwaysFalse, undefined, passingValidator(), errors, true, false, false, false);

      assert.equal(result.valid, true);
    });

    void it('returns valid when if false and no else', () => {
      const errors: ValidationErrorType[] = [];
      const result = Composition.validateIfThenElse('test', '', alwaysFalse, undefined, undefined, errors, true, false, false, false);

      assert.equal(result.valid, true);
    });
  });

  void describe('validateDependentSchemas', () => {
    void it('returns valid when validators is undefined', () => {
      const errors: ValidationErrorType[] = [];
      const result = Composition.validateDependentSchemas({ 'a': 1 }, '', undefined, errors, true, false, false, false);

      assert.equal(result.valid, true);
      assert.equal(result.earlyExit, false);
    });

    void it('returns valid when trigger present and schema passes', () => {
      const errors: ValidationErrorType[] = [];
      const deps = [{
        'trigger': 'a',
        'validator': passingValidator()
      }];
      const result = Composition.validateDependentSchemas({ 'a': 1 }, '', deps, errors, true, false, false, false);

      assert.equal(result.valid, true);
      assert.equal(result.earlyExit, false);
    });

    void it('returns valid for non-object value', () => {
      const errors: ValidationErrorType[] = [];
      const deps = [{
        'trigger': 'a',
        'validator': failingValidator()
      }];
      const result = Composition.validateDependentSchemas('not-an-object', '', deps, errors, true, false, false, false);

      assert.equal(result.valid, true);
    });
  });

  void describe('validateCustomKeywords', () => {
    void it('returns valid when entries is undefined', () => {
      const result = Composition.validateCustomKeywords('', 'test');

      assert.equal(result.valid, true);
      assert.equal(result.errors.length, 0);
    });

    void it('returns valid when all pass', () => {
      const entries: CustomKeywordEntryInterface[] = [{
        'allowedTypes': undefined,
        'keyword': 'x-even',
        'schemaValue': true,
        'validate': (() => {
          return true;
        }) as CustomKeywordEntryInterface['validate']
      }];
      const result = Composition.validateCustomKeywords('', 42, entries);

      assert.equal(result.valid, true);
      assert.equal(result.errors.length, 0);
    });

    void it('returns invalid when one fails', () => {
      const entries: CustomKeywordEntryInterface[] = [{
        'allowedTypes': undefined,
        'keyword': 'x-fail',
        'schemaValue': true,
        'validate': (() => {
          return false;
        }) as CustomKeywordEntryInterface['validate']
      }];
      const result = Composition.validateCustomKeywords('/root', 42, entries);

      assert.equal(result.valid, false);
      assert.equal(result.errors.length, 1);
    });
  });
});
