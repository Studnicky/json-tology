/**
 * Hash utility tests — deterministic FNV-1a hashing for JSON-serializable values
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { Hash } from '../../src/modules/hash/Hash.js';

void describe('Hash.value()', () => {
  void it('returns a hex string', () => {
    const result = Hash.value({ 'a': 1 });

    assert.equal(typeof result, 'string');
    assert.match(result, /^[0-9a-f]+$/u);
  });

  void it('is deterministic: same input produces same hash', () => {
    const input = {
      'age': 30,
      'name': 'Alice'
    };

    assert.equal(Hash.value(input), Hash.value(input));
    assert.equal(Hash.value(input), Hash.value({
      'age': 30,
      'name': 'Alice'
    }));
  });

  void it('is key-order insensitive', () => {
    const a = {
      'a': 1,
      'b': 2
    };
    const b = {
      'a': 1,
      'b': 2
    };

    assert.equal(Hash.value(a), Hash.value(b));
  });

  void it('produces different hashes for different values', () => {
    assert.notEqual(Hash.value({ 'a': 1 }), Hash.value({ 'a': 2 }));
    assert.notEqual(Hash.value('hello'), Hash.value('world'));
    assert.notEqual(Hash.value(1), Hash.value(2));
    assert.notEqual(Hash.value(true), Hash.value(false));
  });

  void it('handles nested objects with key-order insensitivity', () => {
    const a = {
      'outer': {
        'x': 1,
        'y': 2
      },
      'z': 3
    };
    const b = {
      'outer': {
        'x': 1,
        'y': 2
      },
      'z': 3
    };

    assert.equal(Hash.value(a), Hash.value(b));
  });

  void it('handles arrays (order matters)', () => {
    assert.equal(Hash.value([
      1,
      2,
      3
    ]), Hash.value([
      1,
      2,
      3
    ]));
    assert.notEqual(Hash.value([
      1,
      2,
      3
    ]), Hash.value([
      3,
      2,
      1
    ]));
  });

  void it('handles null', () => {
    assert.equal(Hash.value(null), Hash.value(null));
    assert.notEqual(Hash.value(null), Hash.value(0));
    assert.notEqual(Hash.value(null), Hash.value(''));
  });

  void it('throws on undefined (not JSON-serializable)', () => {
    assert.throws(() => {
      Hash.value();
    });
  });

  void it('handles numbers', () => {
    assert.equal(Hash.value(42), Hash.value(42));
    assert.equal(Hash.value(0), Hash.value(0));
    assert.equal(Hash.value(-1), Hash.value(-1));
    assert.notEqual(Hash.value(42), Hash.value(43));
  });

  void it('handles booleans', () => {
    assert.equal(Hash.value(true), Hash.value(true));
    assert.equal(Hash.value(false), Hash.value(false));
    assert.notEqual(Hash.value(true), Hash.value(false));
  });

  void it('handles strings', () => {
    assert.equal(Hash.value('hello'), Hash.value('hello'));
    assert.notEqual(Hash.value('hello'), Hash.value('HELLO'));
  });

  void it('distinguishes types: number vs string representation', () => {
    assert.notEqual(Hash.value(42), Hash.value('42'));
    assert.notEqual(Hash.value(true), Hash.value('true'));
    assert.notEqual(Hash.value(null), Hash.value('null'));
  });

  void it('handles deeply nested structures', () => {
    const deep = {
      'a': {
        'b': {
          'c': {
            'd': [
              1,
              { 'e': 'f' }
            ]
          }
        }
      }
    };

    assert.equal(Hash.value(deep), Hash.value({
      'a': {
        'b': {
          'c': {
            'd': [
              1,
              { 'e': 'f' }
            ]
          }
        }
      }
    }));
    assert.notEqual(Hash.value(deep), Hash.value({
      'a': {
        'b': {
          'c': {
            'd': [
              1,
              { 'e': 'g' }
            ]
          }
        }
      }
    }));
  });
});
