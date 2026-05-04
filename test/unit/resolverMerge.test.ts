/**
 * Resolver.merge — per-call option merging utility
 *
 * Two-level merge: base values overridden by defined keys in override.
 * Keys whose value is undefined in override inherit the base value.
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { Resolver } from '../../src/modules/data/Resolver.js';

void describe('Resolver.merge()', () => {
  void it('returns base when override is undefined', () => {
    const base = {
      'applyDefaults': true,
      'castTypes': false,
      'collectErrors': true
    };
    const result = Resolver.merge(base);

    assert.deepEqual(result, base);
  });

  void it('override keys win when defined', () => {
    const base = {
      'applyDefaults': true,
      'collectErrors': true
    };
    const result = Resolver.merge(base, { 'applyDefaults': false });

    assert.equal(result.applyDefaults, false, 'override key replaces base value');
    assert.equal(result.collectErrors, true, 'unrelated base key is preserved');
  });

  void it('override keys with undefined value do NOT blank base', () => {
    const base = {
      'applyDefaults': true,
      'castTypes': false
    };
    const override: Partial<typeof base> = { 'applyDefaults': undefined };
    const result = Resolver.merge(base, override);

    assert.equal(result.applyDefaults, true, 'undefined override does not overwrite base');
  });

  void it('empty override object returns shallow-cloned base unchanged', () => {
    const base = {
      'applyDefaults': true,
      'collectErrors': true
    };
    const result = Resolver.merge(base, {});

    assert.deepEqual(result, base);
    assert.notEqual(result, base, 'result is a new object, not the same reference');
  });

  void it('nested object values are NOT deep-merged (shallow only)', () => {
    interface NestedRecord { 'nested': { 'a': number;
      'b'?: number } }
    const base: NestedRecord = {
      'nested': {
        'a': 1,
        'b': 2
      }
    };
    const override: Partial<NestedRecord> = { 'nested': { 'a': 99 } };
    const result = Resolver.merge(base, override);

    assert.equal(result.nested.a, 99, 'override nested.a wins');
    assert.equal(result.nested.b, undefined, 'shallow merge: base nested.b is not preserved');
  });

  void it('type signature preserves the T shape', () => {
    const base = {
      'applyDefaults': true,
      'castTypes': false,
      'collectErrors': true,
      'removeAdditionalProperties': true
    };
    const result = Resolver.merge(base, { 'applyDefaults': false });

    // Compile-time check: assignment satisfies the T shape constraint
    const _typeCheck: typeof base = result;

    assert.equal(_typeCheck.applyDefaults, false, 'result satisfies the T shape');
    assert.equal(typeof result.applyDefaults, 'boolean');
    assert.equal(typeof result.castTypes, 'boolean');
  });
});
