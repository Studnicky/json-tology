import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { Scalars } from '../../src/modules/validation/exec/Scalars.js';

function emailValidator(value: unknown): boolean {
  return typeof value === 'string' && value.includes('@');
}

void describe('Scalars', () => {
  void describe('validateConst', () => {
    void it('returns valid when hasConst is false', () => {
      const result = Scalars.validateConst('/x', 'anything', false);

      assert.equal(result.valid, true);
      assert.equal(result.errors.length, 0);
    });

    void it('returns valid when value matches constVal', () => {
      const result = Scalars.validateConst('/x', 42, true, 42);

      assert.equal(result.valid, true);
      assert.equal(result.errors.length, 0);
    });

    void it('returns invalid with error when value does not match constVal', () => {
      const result = Scalars.validateConst('/x', 'wrong', true, 'expected');

      assert.equal(result.valid, false);
      assert.equal(result.errors.length, 1);
      assert.equal(result.errors[0].keyword, 'const');
      assert.equal(result.errors[0].path, '/x');
    });
  });

  void describe('validateEnum', () => {
    void it('returns valid when enumValues is undefined', () => {
      const result = Scalars.validateEnum('/x', 'anything');

      assert.equal(result.valid, true);
      assert.equal(result.errors.length, 0);
    });

    void it('returns valid when value is in the enum set', () => {
      const enumValues = [
        'a',
        'b',
        'c'
      ];
      const enumSet = new Set<boolean | null | number | string>([
        'a',
        'b',
        'c'
      ]);
      const result = Scalars.validateEnum('/x', 'b', enumValues, enumSet);

      assert.equal(result.valid, true);
      assert.equal(result.errors.length, 0);
    });

    void it('returns invalid when value is not in the enum set', () => {
      const enumValues = [
        'a',
        'b',
        'c'
      ];
      const enumSet = new Set<boolean | null | number | string>([
        'a',
        'b',
        'c'
      ]);
      const result = Scalars.validateEnum('/x', 'z', enumValues, enumSet);

      assert.equal(result.valid, false);
      assert.equal(result.errors.length, 1);
      assert.equal(result.errors[0].keyword, 'enum');
      assert.equal(result.errors[0].path, '/x');
    });
  });

  void describe('validateFormat', () => {
    void it('returns valid when formatValidator is undefined', () => {
      const result = Scalars.validateFormat('/x', 'anything');

      assert.equal(result.valid, true);
      assert.equal(result.errors.length, 0);
    });

    void it('returns valid when formatValidator passes', () => {
      const result = Scalars.validateFormat('/x', 'a@b.com', 'email', emailValidator);

      assert.equal(result.valid, true);
      assert.equal(result.errors.length, 0);
    });

    void it('returns invalid when formatValidator fails', () => {
      const result = Scalars.validateFormat('/x', 'not-an-email', 'email', emailValidator);

      assert.equal(result.valid, false);
      assert.equal(result.errors.length, 1);
      assert.equal(result.errors[0].keyword, 'format');
      assert.match(result.errors[0].message, /email/u);
    });
  });

  void describe('validateString', () => {
    void it('returns valid when value is within bounds', () => {
      const result = Scalars.validateString('/x', 'hello', 2, 10);

      assert.equal(result.valid, true);
      assert.equal(result.errors.length, 0);
    });

    void it('returns invalid when value is below minLength', () => {
      const result = Scalars.validateString('/x', 'hi', 5);

      assert.equal(result.valid, false);
      assert.equal(result.errors.length, 1);
      assert.equal(result.errors[0].keyword, 'minLength');
    });

    void it('returns invalid when value is above maxLength', () => {
      const result = Scalars.validateString('/x', 'hello world', undefined, 5);

      assert.equal(result.valid, false);
      assert.equal(result.errors.length, 1);
      assert.equal(result.errors[0].keyword, 'maxLength');
    });

    void it('returns valid when value matches pattern', () => {
      const result = Scalars.validateString('/x', 'abc123', undefined, undefined, /^[a-z]+\d+$/u, '^[a-z]+\\d+$');

      assert.equal(result.valid, true);
      assert.equal(result.errors.length, 0);
    });

    void it('returns invalid when value does not match pattern', () => {
      const result = Scalars.validateString('/x', '!!!', undefined, undefined, /^[a-z]+$/u, '^[a-z]+$');

      assert.equal(result.valid, false);
      assert.equal(result.errors.length, 1);
      assert.equal(result.errors[0].keyword, 'pattern');
    });

    void it('returns valid when all constraints are undefined', () => {
      const result = Scalars.validateString('/x', 'anything');

      assert.equal(result.valid, true);
      assert.equal(result.errors.length, 0);
    });
  });

  void describe('validateNumber', () => {
    void it('returns valid when all constraints are undefined', () => {
      const result = Scalars.validateNumber('/x', 42);

      assert.equal(result.valid, true);
      assert.equal(result.errors.length, 0);
    });

    void it('returns invalid when value is below minimum', () => {
      const result = Scalars.validateNumber('/x', 3, 5);

      assert.equal(result.valid, false);
      assert.equal(result.errors.length, 1);
      assert.equal(result.errors[0].keyword, 'minimum');
    });

    void it('returns invalid when value is above maximum', () => {
      const result = Scalars.validateNumber('/x', 20, undefined, 10);

      assert.equal(result.valid, false);
      assert.equal(result.errors.length, 1);
      assert.equal(result.errors[0].keyword, 'maximum');
    });

    void it('returns invalid when value is at exclusiveMinimum', () => {
      const result = Scalars.validateNumber('/x', 5, undefined, undefined, 5);

      assert.equal(result.valid, false);
      assert.equal(result.errors.length, 1);
      assert.equal(result.errors[0].keyword, 'exclusiveMinimum');
    });

    void it('returns invalid when value is at exclusiveMaximum', () => {
      const result = Scalars.validateNumber('/x', 10, undefined, undefined, undefined, 10);

      assert.equal(result.valid, false);
      assert.equal(result.errors.length, 1);
      assert.equal(result.errors[0].keyword, 'exclusiveMaximum');
    });

    void it('returns invalid when value is not a multiple of multipleOf', () => {
      const result = Scalars.validateNumber('/x', 7, undefined, undefined, undefined, undefined, 3);

      assert.equal(result.valid, false);
      assert.equal(result.errors.length, 1);
      assert.equal(result.errors[0].keyword, 'multipleOf');
    });
  });

  void describe('validateType', () => {
    void it('returns valid when types array is empty', () => {
      const result = Scalars.validateType('/x', [], 'anything');

      assert.equal(result.valid, true);
      assert.equal(result.errors.length, 0);
    });

    void it('returns valid when value matches a single type', () => {
      const result = Scalars.validateType('/x', ['string'], 'hello');

      assert.equal(result.valid, true);
      assert.equal(result.errors.length, 0);
    });

    void it('returns valid when value matches one of multiple types', () => {
      const result = Scalars.validateType('/x', [
        'string',
        'number'
      ], 42);

      assert.equal(result.valid, true);
      assert.equal(result.errors.length, 0);
    });

    void it('returns invalid when value matches no type', () => {
      const result = Scalars.validateType('/x', ['string'], 42);

      assert.equal(result.valid, false);
      assert.equal(result.errors.length, 1);
      assert.equal(result.errors[0].keyword, 'type');
      assert.equal(result.errors[0].path, '/x');
    });
  });
});
