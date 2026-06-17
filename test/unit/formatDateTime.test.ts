/**
 * Focused tests for the RFC 3339 date-time format validator in FormatRegistry.
 *
 * The validator is structurally correct and allocation-free: it validates
 * full-date (including leap year bounds), the T/t separator, HH:MM:SS,
 * optional fractional seconds, and a MANDATORY time offset (Z/z/±HH:MM).
 *
 * This is deliberately stricter than Date.parse — offset-less strings are
 * rejected per RFC 3339 §5.6.
 */

import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';
import { FormatRegistry } from '../../src/modules/format/FormatRegistry.js';

const registry = FormatRegistry.builtin();

function check(value: unknown): boolean {
  const validator = registry.get('date-time');

  assert.ok(validator !== undefined, 'date-time format must be registered');

  return validator(value);
}

// ---------------------------------------------------------------------------
// Accept cases
// ---------------------------------------------------------------------------

void describe('date-time accept', () => {
  void it('UTC Z offset', () => {
    assert.ok(check('2020-01-01T00:00:00Z'), 'Z offset must be accepted');
  });

  void it('lowercase t separator and lowercase z offset', () => {
    assert.ok(check('2020-01-01t00:00:00z'), 'lowercase t and z must be accepted per RFC 3339');
  });

  void it('positive +00:00 offset', () => {
    assert.ok(check('2020-01-01T00:00:00+00:00'), '+00:00 offset must be accepted');
  });

  void it('negative -05:30 offset', () => {
    assert.ok(check('2020-01-01T00:00:00-05:30'), '-05:30 offset must be accepted');
  });

  void it('fractional seconds with Z', () => {
    assert.ok(check('2020-01-01T00:00:00.123Z'), 'fractional seconds must be accepted');
  });

  void it('multi-digit fractional seconds', () => {
    assert.ok(check('2020-01-01T00:00:00.123456Z'), 'multi-digit fractional seconds must be accepted');
  });

  void it('leap day on leap year', () => {
    assert.ok(check('2020-02-29T12:00:00Z'), 'leap day on a leap year must be accepted');
  });

  void it('leap second :60', () => {
    assert.ok(check('2020-01-01T23:59:60Z'), 'leap second (:60) must be accepted per RFC 3339');
  });

  void it('year 2000 leap day (divisible by 400)', () => {
    assert.ok(check('2000-02-29T00:00:00Z'), '2000 is a leap year (divisible by 400)');
  });

  void it('max time 23:59:59 with offset', () => {
    assert.ok(check('2020-06-15T23:59:59+05:30'), 'max time with positive offset');
  });

  void it('fractional seconds with negative offset', () => {
    assert.ok(check('2020-06-15T12:00:00.999-08:00'), 'fractional seconds with negative offset');
  });
});

// ---------------------------------------------------------------------------
// Reject cases
// ---------------------------------------------------------------------------

void describe('date-time reject', () => {
  void it('offset-less date-time (lenient Date.parse behaviour)', () => {
    assert.equal(check('2020-01-01T00:00:00'), false, 'RFC 3339 requires an offset — must be rejected');
  });

  void it('missing T separator (date only)', () => {
    assert.equal(check('2020-01-01'), false, 'date-only string must be rejected');
  });

  void it('space instead of T separator', () => {
    assert.equal(check('2020-01-01 00:00:00Z'), false, 'space separator is not valid RFC 3339');
  });

  void it('bad month 13', () => {
    assert.equal(check('2020-13-01T00:00:00Z'), false, 'month 13 must be rejected');
  });

  void it('bad month 0', () => {
    assert.equal(check('2020-00-01T00:00:00Z'), false, 'month 0 must be rejected');
  });

  void it('non-leap Feb 29 (year 2021)', () => {
    assert.equal(check('2021-02-29T00:00:00Z'), false, '2021 is not a leap year');
  });

  void it('non-leap Feb 29 (year 1900, divisible by 100 not 400)', () => {
    assert.equal(check('1900-02-29T00:00:00Z'), false, '1900 is not a leap year');
  });

  void it('bad day 0', () => {
    assert.equal(check('2020-01-00T00:00:00Z'), false, 'day 0 must be rejected');
  });

  void it('hour 25', () => {
    assert.equal(check('2020-01-01T25:00:00Z'), false, 'hour 25 must be rejected');
  });

  void it('minute 60', () => {
    assert.equal(check('2020-01-01T00:60:00Z'), false, 'minute 60 must be rejected');
  });

  void it('second 61', () => {
    assert.equal(check('2020-01-01T00:00:61Z'), false, 'second 61 must be rejected');
  });

  void it('non-string (number)', () => {
    assert.equal(check(1_234_567_890), false, 'number must be rejected');
  });

  void it('garbage string', () => {
    assert.equal(check('not-a-datetime'), false, 'garbage must be rejected');
  });

  void it('trailing garbage after valid datetime', () => {
    assert.equal(check('2020-01-01T00:00:00ZEXTRA'), false, 'trailing content must be rejected');
  });

  void it('fractional seconds with no digits after dot', () => {
    assert.equal(check('2020-01-01T00:00:00.Z'), false, 'dot with no digits must be rejected');
  });
});
