/**
 * BaseError.retryable contract + propagation.
 *
 * `retryable` is `true` only for transient failures (e.g. HTTP 5xx via
 * SchemaLoadError) and `false` (default) for deterministic failures. The flag is
 * preserved per-error through `toJson()` and through every link of `flatten()`.
 */

import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';
import { SchemaLoadError } from '../../src/errors/SchemaLoadError.js';
import { GraphError } from '../../src/errors/GraphError.js';
import { SchemaError } from '../../src/errors/SchemaError.js';
import {
  GraphErrorCode, SchemaErrorCode, SchemaLoadErrorCode
} from '../../src/constants/ERROR_CODES.js';

function transientError(): SchemaLoadError {
  return new SchemaLoadError('HTTP 503 loading https://ex/Schema', {
    'code': SchemaLoadErrorCode.LOAD_FAILED,
    'file': 'https://ex/Schema',
    'reason': 'fetch-failed',
    'retryable': true,
    'status': 503
  });
}

void describe('BaseError.retryable contract', { 'concurrency': true }, () => {
  void it('a transient failure (SchemaLoadError 5xx) is retryable', () => {
    const error = transientError();

    assert.strictEqual(error.retryable, true);
    assert.strictEqual(error.toJson().retryable, true);
  });

  void it('a deterministic failure (GraphError) is not retryable by default', () => {
    const error = new GraphError('pointer not found', { 'code': GraphErrorCode.POINTER_NOT_FOUND });

    assert.strictEqual(error.retryable, false);
    assert.strictEqual(error.toJson().retryable, false);
  });

  void it('omitting retryable defaults to false', () => {
    const error = new SchemaError('not registered', { 'code': SchemaErrorCode.NOT_REGISTERED });

    assert.strictEqual(error.retryable, false);
  });
});

void describe('BaseError.retryable propagation through flatten()', { 'concurrency': true }, () => {
  void it('preserves the retryable flag of each chain link, root-first', () => {
    // A deterministic wrapper whose cause is a transient (retryable) failure.
    const wrapper = new SchemaError('registration failed while loading $ref', {
      'cause': transientError(),
      'code': SchemaErrorCode.NOT_REGISTERED
    });

    const chain = wrapper.flatten();

    assert.strictEqual(chain.length, 2, 'flatten yields wrapper + cause');
    const chain0 = chain.at(0);
    const chain1 = chain.at(1);

    if (chain0 === undefined || chain1 === undefined) {
      throw new Error('expected chain to have 2 elements');
    }
    assert.strictEqual(chain0.retryable, false, 'the deterministic wrapper is not retryable');
    assert.strictEqual(chain0.code, SchemaErrorCode.NOT_REGISTERED);
    assert.strictEqual(chain1.retryable, true, 'the transient cause stays retryable');
    assert.strictEqual(chain1.code, SchemaLoadErrorCode.LOAD_FAILED);
  });

  void it('toJson() nests the cause with its own retryable flag', () => {
    const wrapper = new SchemaError('wrap', {
      'cause': transientError(),
      'code': SchemaErrorCode.NOT_REGISTERED
    });

    const json = wrapper.toJson();

    assert.strictEqual(json.retryable, false);
    assert.ok(json.cause !== undefined, 'cause is serialized');
    assert.strictEqual(json.cause.retryable, true);
  });
});
