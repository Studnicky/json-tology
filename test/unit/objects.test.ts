import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { Objects } from '../../src/modules/validation/exec/Objects.js';
import type { ValidationErrorType } from '../../src/types/Validation.js';
import type { ValidateWithErrorsFnType } from '../../src/types/Validation.js';

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

function coercingValidator(coercedValue: unknown): ValidateWithErrorsFnType {
  return (() => {
    return {
      'valid': true,
      'value': coercedValue
    };
  }) as ValidateWithErrorsFnType;
}

void describe('Objects', () => {
  void describe('applyDefaults', () => {
    void it('applies missing defaults', () => {
      const obj: Record<string, unknown> = { 'a': 1 };
      const defaults = new Map<string, { 'defaultValue': unknown;
        'hasDefault': boolean }>([[
        'b',
        {
          'defaultValue': 42,
          'hasDefault': true
        }
      ]]);

      Objects.applyDefaults(obj, defaults);

      assert.equal(obj.b, 42);
    });

    void it('does not overwrite existing keys', () => {
      const obj: Record<string, unknown> = { 'a': 1 };
      const defaults = new Map<string, { 'defaultValue': unknown;
        'hasDefault': boolean }>([[
        'a',
        {
          'defaultValue': 999,
          'hasDefault': true
        }
      ]]);

      Objects.applyDefaults(obj, defaults);

      assert.equal(obj.a, 1);
    });

    void it('skips when hasDefault is false', () => {
      const obj: Record<string, unknown> = {};
      const defaults = new Map<string, { 'defaultValue': unknown;
        'hasDefault': boolean }>([[
        'x',
        {
          'defaultValue': 'nope',
          'hasDefault': false
        }
      ]]);

      Objects.applyDefaults(obj, defaults);

      assert.equal('x' in obj, false);
    });
  });

  void describe('validateDependentRequired', () => {
    void it('returns valid when no entries', () => {
      const errors: ValidationErrorType[] = [];
      const result = Objects.validateDependentRequired('', { 'a': 1 }, [], errors, true);

      assert.equal(result.valid, true);
      assert.equal(result.earlyExit, false);
      assert.equal(errors.length, 0);
    });

    void it('returns valid when trigger present and dep present', () => {
      const errors: ValidationErrorType[] = [];
      const entries: Array<[string, string[]]> = [[
        'a',
        ['b']
      ]];
      const result = Objects.validateDependentRequired('', {
        'a': 1,
        'b': 2
      }, entries, errors, true);

      assert.equal(result.valid, true);
      assert.equal(errors.length, 0);
    });

    void it('returns invalid when trigger present and dep missing', () => {
      const errors: ValidationErrorType[] = [];
      const entries: Array<[string, string[]]> = [[
        'a',
        ['b']
      ]];
      const result = Objects.validateDependentRequired('', { 'a': 1 }, entries, errors, true);

      assert.equal(result.valid, false);
      assert.equal(errors.length, 1);
    });

    void it('returns valid for non-object value', () => {
      const errors: ValidationErrorType[] = [];
      const entries: Array<[string, string[]]> = [[
        'a',
        ['b']
      ]];
      const result = Objects.validateDependentRequired('', 'not-an-object', entries, errors, true);

      assert.equal(result.valid, true);
    });

    void it('earlyExits when collectErrors is false', () => {
      const errors: ValidationErrorType[] = [];
      const entries: Array<[string, string[]]> = [[
        'a',
        [
          'b',
          'c'
        ]
      ]];
      const result = Objects.validateDependentRequired('', { 'a': 1 }, entries, errors, false);

      assert.equal(result.valid, false);
      assert.equal(result.earlyExit, true);
      assert.equal(errors.length, 0);
    });
  });

  void describe('validateRequired', () => {
    void it('returns valid when required is undefined', () => {
      const result = Objects.validateRequired('', { 'a': 1 });

      assert.equal(result.valid, true);
      assert.equal(result.errors.length, 0);
    });

    void it('returns valid when all required present', () => {
      const result = Objects.validateRequired('', {
        'a': 1,
        'b': 2
      }, [
        'a',
        'b'
      ]);

      assert.equal(result.valid, true);
      assert.equal(result.errors.length, 0);
    });

    void it('returns invalid with error when missing required', () => {
      const result = Objects.validateRequired('/root', { 'a': 1 }, [
        'a',
        'b'
      ]);

      assert.equal(result.valid, false);
      assert.equal(result.errors.length, 1);
    });
  });

  void describe('validateProperties', () => {
    void it('validates known property', () => {
      const propValidators = new Map<string, ValidateWithErrorsFnType>([[
        'name',
        passingValidator()
      ]]);
      const errors: ValidationErrorType[] = [];
      const defaults = new Map<string, { 'defaultValue': unknown;
        'hasDefault': boolean }>();

      const result = Objects.validateProperties(
        '',
        { 'name': 'Alice' },
        propValidators,
        undefined,
        false,
        undefined,
        undefined,
        false,
        defaults,
        errors,
        true,
        false,
        false
      );

      assert.equal(result.valid, true);
      assert.equal(result.earlyExit, false);
    });

    void it('returns invalid for unknown property with additionalIsFalse', () => {
      const propValidators = new Map<string, ValidateWithErrorsFnType>();
      const errors: ValidationErrorType[] = [];
      const defaults = new Map<string, { 'defaultValue': unknown;
        'hasDefault': boolean }>();

      const result = Objects.validateProperties(
        '',
        { 'extra': 'bad' },
        propValidators,
        undefined,
        true,
        undefined,
        undefined,
        false,
        defaults,
        errors,
        true,
        false,
        false
      );

      assert.equal(result.valid, false);
      assert.equal(errors.length, 1);
    });

    void it('strips unknown keys when stripUnknown is true', () => {
      const propValidators = new Map<string, ValidateWithErrorsFnType>([[
        'name',
        passingValidator()
      ]]);
      const errors: ValidationErrorType[] = [];
      const defaults = new Map<string, { 'defaultValue': unknown;
        'hasDefault': boolean }>();
      const allowedKeys = new Set(['name']);
      const obj: Record<string, unknown> = {
        'extra': 'removed',
        'name': 'Alice'
      };

      Objects.validateProperties(
        '',
        obj,
        propValidators,
        undefined,
        false,
        undefined,
        allowedKeys,
        true,
        defaults,
        errors,
        true,
        false,
        false
      );

      assert.equal('extra' in obj, false);
      assert.equal(obj.name, 'Alice');
    });

    void it('matches pattern property', () => {
      const propValidators = new Map<string, ValidateWithErrorsFnType>();
      const patternPropValidators = [{
        'regex': /^x-/u,
        'validator': coercingValidator('coerced')
      }];
      const errors: ValidationErrorType[] = [];
      const defaults = new Map<string, { 'defaultValue': unknown;
        'hasDefault': boolean }>();
      const obj: Record<string, unknown> = { 'x-custom': 'original' };

      const result = Objects.validateProperties(
        '',
        obj,
        propValidators,
        patternPropValidators,
        false,
        undefined,
        undefined,
        false,
        defaults,
        errors,
        true,
        false,
        false
      );

      assert.equal(result.valid, true);
      assert.equal(obj['x-custom'], 'coerced');
    });
  });

  void describe('validatePropertyCount', () => {
    void it('returns valid when within bounds', () => {
      const result = Objects.validatePropertyCount('', {
        'a': 1,
        'b': 2
      }, 1, 3);

      assert.equal(result.valid, true);
      assert.equal(result.errors.length, 0);
    });

    void it('returns invalid when below minProperties', () => {
      const result = Objects.validatePropertyCount('', { 'a': 1 }, 2);

      assert.equal(result.valid, false);
      assert.equal(result.errors.length, 1);
    });

    void it('returns invalid when above maxProperties', () => {
      const result = Objects.validatePropertyCount('', {
        'a': 1,
        'b': 2,
        'c': 3
      }, undefined, 2);

      assert.equal(result.valid, false);
      assert.equal(result.errors.length, 1);
    });
  });

  void describe('validatePropertyNames', () => {
    void it('returns valid when validator is undefined', () => {
      const errors: ValidationErrorType[] = [];
      const result = Objects.validatePropertyNames('', { 'a': 1 }, undefined, errors, true);

      assert.equal(result.valid, true);
      assert.equal(result.earlyExit, false);
    });

    void it('returns valid when all names pass', () => {
      const errors: ValidationErrorType[] = [];
      const result = Objects.validatePropertyNames('', { 'ok': 1 }, passingValidator(), errors, true);

      assert.equal(result.valid, true);
      assert.equal(result.earlyExit, false);
    });

    void it('returns invalid when a name fails', () => {
      const errors: ValidationErrorType[] = [];
      const result = Objects.validatePropertyNames('', { 'bad': 1 }, failingValidator(), errors, true);

      assert.equal(result.valid, false);
      assert.equal(errors.length, 1);
    });
  });
});
