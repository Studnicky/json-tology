/**
 * Unit tests for SchemaLoadError and Loaders.fetch HTTP-status surfacing.
 */

import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';
import { SchemaLoadError } from '../../src/errors/SchemaLoadError.js';
import { SCHEMA_LOAD_ERROR_CODE } from '../../src/constants/ERROR_CODES.js';
import { Loaders } from '../../src/modules/loaders/Loaders.js';
import type { SchemaLoadErrorEntity } from '../../src/entities/SchemaLoadErrorEntity.js';

// Test 1: Loaders.fetch with 503 throws SchemaLoadError with correct fields
void describe('Loaders.fetch — HTTP status surfacing', { 'concurrency': false }, () => {
  void it('throws SchemaLoadError for 5xx response (503)', async (ctx) => {
    ctx.mock.method(globalThis, 'fetch', async (): Promise<Response> => {
      return {
        'json': async () => {
          return {};
        },
        'ok': false,
        'status': 503
      } as unknown as Response;
    });

    const loader = Loaders.fetch();

    await assert.rejects(
      () => {
        return loader('https://example.com/Schema');
      },
      (err: unknown) => {
        assert.ok(err instanceof SchemaLoadError, `expected SchemaLoadError, got: ${String(err)}`);
        assert.strictEqual(err.code, 'SCHEMA_LOAD_FAILED');
        assert.strictEqual(err.status, 503);
        assert.strictEqual(err.reason, 'fetch-failed');
        assert.strictEqual(err.retryable, true);

        return true;
      }
    );
  });

  void it('returns null for 404 response (not throw)', async (ctx) => {
    ctx.mock.method(globalThis, 'fetch', async (): Promise<Response> => {
      return {
        'json': async () => {
          return {};
        },
        'ok': false,
        'status': 404
      } as unknown as Response;
    });

    const loader = Loaders.fetch();
    const result = await loader('https://example.com/Missing');

    assert.strictEqual(result, null);
  });
});

// Test 2: SchemaLoadError round-trip through toJson() and toLoadError()
void describe('SchemaLoadError — serialization', { 'concurrency': true }, () => {
  void it('toJson includes file, reason, and status', () => {
    const err = new SchemaLoadError('HTTP 503 loading https://example.com/Schema', {
      'code': SCHEMA_LOAD_ERROR_CODE.LOAD_FAILED,
      'file': 'https://example.com/Schema',
      'reason': 'fetch-failed',
      'retryable': true,
      'status': 503
    });

    const json = err.toJson();

    assert.strictEqual(json.code, 'SCHEMA_LOAD_FAILED');
    assert.strictEqual(json.message, 'HTTP 503 loading https://example.com/Schema');
    assert.strictEqual(json.retryable, true);
    // file and reason are included in the override
    const extended = json as typeof json & { 'file': unknown;
      'reason': unknown;
      'status': unknown };

    assert.strictEqual(extended.file, 'https://example.com/Schema');
    assert.strictEqual(extended.reason, 'fetch-failed');
    assert.strictEqual(extended.status, 503);
  });

  void it('toJson omits status when not present', () => {
    const err = new SchemaLoadError('missing $id', {
      'code': SCHEMA_LOAD_ERROR_CODE.LOAD_FAILED,
      'file': 'https://example.com/Schema',
      'reason': 'missing-id',
      'retryable': false
    });

    const json = err.toJson() as Record<string, unknown>;

    assert.strictEqual('status' in json, false);
  });

  void it('toLoadError returns a valid SchemaLoadErrorEntity descriptor', () => {
    const err = new SchemaLoadError('HTTP 503 loading https://example.com/Schema', {
      'code': SCHEMA_LOAD_ERROR_CODE.LOAD_FAILED,
      'file': 'https://example.com/Schema',
      'reason': 'fetch-failed',
      'retryable': true,
      'status': 503
    });

    const loadError: SchemaLoadErrorEntity.Type = err.toLoadError();

    assert.strictEqual(loadError.file, 'https://example.com/Schema');
    assert.strictEqual(loadError.message, 'HTTP 503 loading https://example.com/Schema');
    assert.strictEqual(loadError.reason, 'fetch-failed');
    assert.strictEqual(loadError.status, 503);
  });

  void it('toLoadError omits status when undefined', () => {
    const err = new SchemaLoadError('missing $id', {
      'code': SCHEMA_LOAD_ERROR_CODE.LOAD_FAILED,
      'file': 'https://example.com/Schema',
      'reason': 'missing-id',
      'retryable': false
    });

    const loadError = err.toLoadError();

    assert.strictEqual('status' in loadError, false);
  });
});

// Test 3: ReferenceResolutionLoader non-string $id → SchemaLoadError
void describe('ReferenceResolutionLoader — non-string $id → SchemaLoadError', { 'concurrency': true }, () => {
  void it('loadRootIds throws SchemaLoadError with reason missing-id when loader returns schema with non-string $id', async () => {
    // Import ReferenceResolutionLoader and SchemaRegistry here
    const { ReferenceResolutionLoader } = await import('../../src/modules/registry/ReferenceResolutionLoader.js');
    const { SchemaRegistry } = await import('../../src/modules/registry/SchemaRegistry.js');

    const registry = new SchemaRegistry();
    const referenceLoader = new ReferenceResolutionLoader(registry);

    await assert.rejects(
      () => {
        return referenceLoader.loadRootIds(['https://ex/NullId'], async (_iri) => {
          return {
            '$id': 123 as unknown as string,
            'type': 'string'
          };
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof SchemaLoadError, `expected SchemaLoadError, got: ${String(err)}`);
        assert.strictEqual(err.code, 'SCHEMA_LOAD_FAILED');
        assert.strictEqual(err.reason, 'missing-id');

        return true;
      }
    );
  });
});
