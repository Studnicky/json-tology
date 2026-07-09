/**
 * Mechanical pattern hardening — unit tests for four swallow-site fixes.
 *
 * Covers:
 *  1. InvariantStore.runAll  — throwing invariant wraps as InstantiationError
 *  2. Lift.resolveNodeForType — POINTER_NOT_FOUND is swallowed; other GraphErrors rethrow
 *  3. RefResolutionLoader    — non-string $id throws SchemaLoadError(SCHEMA_LOAD_FAILED)
 */

import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';

import { InvariantStore } from '../../src/modules/registry/InvariantStore.js';
import { Lift } from '../../src/modules/rdf/Lift.js';
import { RefResolutionLoader } from '../../src/modules/registry/RefResolutionLoader.js';
import { SchemaRegistry } from '../../src/modules/registry/SchemaRegistry.js';
import { GraphError } from '../../src/errors/GraphError.js';
import { SchemaLoadError } from '../../src/errors/SchemaLoadError.js';
import { InstantiationError } from '../../src/errors/InstantiationError.js';
import { GRAPH_ERROR_CODE } from '../../src/constants/ERROR_CODES.js';
import type { SchemaRegistryInterface } from '../../src/interfaces/SchemaRegistryInterface.js';
import type { SchemaGraphInterface } from '../../src/interfaces/SchemaGraphInterface.js';
import type { JsonSchemaType } from '../../src/types/Schema.js';

// ---------------------------------------------------------------------------
// 1. InvariantStore — throwing invariant
// ---------------------------------------------------------------------------

void describe('InvariantStore.runAll — throwing invariant', { 'concurrency': true }, () => {
  void it('wraps a throwing invariant fn as InstantiationError with INSTANTIATION_FAILED code', () => {
    const store = new InvariantStore();
    const thrown = new Error('invariant exploded');

    store.add('https://ex/Foo', {
      'fn': () => {
        throw thrown;
      },
      'name': 'explodingInvariant'
    });

    assert.throws(
      () => {
        store.runAll('https://ex/Foo', {});
      },
      (err: unknown) => {
        assert.ok(err instanceof InstantiationError, `expected InstantiationError, got ${String(err)}`);
        assert.equal(err.code, 'INSTANTIATION_FAILED');

        return true;
      }
    );
  });

  void it('original error is reachable via .cause on the wrapping InstantiationError', () => {
    const store = new InvariantStore();
    const original = new Error('root cause');

    store.add('https://ex/Bar', {
      'fn': () => {
        throw original;
      },
      'name': 'causeInvariant'
    });

    assert.throws(
      () => {
        store.runAll('https://ex/Bar', {});
      },
      (err: unknown) => {
        assert.ok(err instanceof InstantiationError, `expected InstantiationError, got ${String(err)}`);
        assert.ok(err.cause instanceof Error, 'expected .cause to be an Error');
        assert.equal(err.cause.message, 'root cause');

        return true;
      }
    );
  });

  void it('invariant name appears in the validation error message', () => {
    const store = new InvariantStore();

    store.add('https://ex/Baz', {
      'fn': () => {
        throw new Error('boom');
      },
      'name': 'myInvariant'
    });

    assert.throws(
      () => {
        store.runAll('https://ex/Baz', {});
      },
      (err: unknown) => {
        assert.ok(err instanceof InstantiationError);
        assert.ok(
          err.message.includes('myInvariant'),
          `expected message to include invariant name, got: "${err.message}"`
        );

        return true;
      }
    );
  });

  void it('non-throwing invariant returning null still accumulates no errors', () => {
    const store = new InvariantStore();

    store.add('https://ex/Ok', {
      'fn': () => {
        return null;
      },
      'name': 'okInvariant'
    });

    const errors = store.runAll('https://ex/Ok', {});

    assert.equal(errors.length, 0);
  });
});

// ---------------------------------------------------------------------------
// 2. Lift.resolveNodeForType — discriminated-catch behaviour
// ---------------------------------------------------------------------------

/**
 * Build a minimal SchemaRegistryInterface stub whose graph() returns a
 * SchemaGraphInterface stub that throws `throwOnResolve` from resolvePointer.
 *
 * The stub only implements the surface accessed by resolveNodeForType:
 *   - registry.graph(id) → the stub graph (or undefined for unknown ids)
 *   - graph.resolvePointer(pointer) → throws `throwOnResolve`
 *   - graph.rootNode → minimal node (not reached in these tests)
 */
function makeRegistryWithThrowingGraph(registeredId: string, throwOnResolve: unknown): SchemaRegistryInterface {
  // Minimal stub: only resolvePointer is called by resolveNodeForType.
  // All other SchemaGraphInterface methods are unreachable in this test path.
  const stubGraph = {
    resolvePointer(_pointer: string): never {
      throw throwOnResolve;
    }
  } as unknown as SchemaGraphInterface;

  return {
    graph(id: string) {
      return id === registeredId ? stubGraph : undefined;
    },
    has(id: string) {
      return id === registeredId;
    }
  } as unknown as SchemaRegistryInterface;
}

void describe('Lift.resolveNodeForType — discriminated-catch', { 'concurrency': true }, () => {
  void it('returns empty array (swallows POINTER_NOT_FOUND) for a pointer-based IRI that does not exist', () => {
    // A real SchemaRegistry + registered schema. The pointer '#/nonexistent' does not
    // exist in the nodeMap, so resolvePointer throws POINTER_NOT_FOUND.
    // resolveNodeForType must return undefined, and Lift.instances returns [].
    const registry = new SchemaRegistry();

    registry.set({
      '$id': 'https://ex/User',
      'properties': { 'name': { 'type': 'string' } },
      'type': 'object'
    });

    // '#/nonexistent' → pointer '/nonexistent' → POINTER_NOT_FOUND (swallowed)
    const result = Lift.instances('https://ex/User#/nonexistent', [], registry);

    assert.deepEqual(result, []);
  });

  void it('rethrows a non-POINTER_NOT_FOUND GraphError from resolvePointer', () => {
    const registeredId = 'https://ex/Schema';

    // POINTER_INVALID is thrown when pointer does not start with '/'.
    // We simulate this by having the stub graph throw it directly — the stub
    // is reached via a pointer-based IRI ('registeredId#/ptr') which passes the
    // hashSlash check and calls resolvePointer('/ptr').
    const nonSwallowedError = new GraphError('pointer invalid', { 'code': GRAPH_ERROR_CODE.POINTER_INVALID });

    const registry = makeRegistryWithThrowingGraph(registeredId, nonSwallowedError);

    assert.throws(
      () => {
        Lift.instances(`${registeredId}#/ptr`, [], registry);
      },
      (err: unknown) => {
        assert.ok(err instanceof GraphError, `expected GraphError, got ${String(err)}`);
        assert.equal(err.code, GRAPH_ERROR_CODE.POINTER_INVALID);

        return true;
      }
    );
  });
});

// ---------------------------------------------------------------------------
// 3. RefResolutionLoader — non-string $id throws SchemaLoadError(SCHEMA_LOAD_FAILED)
// ---------------------------------------------------------------------------

const loaderWithNumericId = async (_iri: string): Promise<JsonSchemaType | null> => {
  // $id is a number — not a string
  return {
    '$id': 123 as unknown as string,
    'type': 'string'
  };
};

const loaderWithMissingId = async (iri: string): Promise<JsonSchemaType | null> => {
  if (iri === 'https://ex/BadId') {
    // $id is undefined — not a string
    return { 'type': 'string' };
  }

  return null;
};

void describe('RefResolutionLoader — non-string $id', { 'concurrency': true }, () => {
  void it('loadRootIds throws SchemaLoadError missing-id when loader returns schema with non-string $id', async () => {
    const registry = new SchemaRegistry();
    const refLoader = new RefResolutionLoader(registry);

    await assert.rejects(
      () => {
        return refLoader.loadRootIds(['https://ex/NullId'], loaderWithNumericId);
      },
      (err: unknown) => {
        assert.ok(err instanceof SchemaLoadError, `expected SchemaLoadError, got: ${String(err)}`);
        assert.equal(err.code, 'SCHEMA_LOAD_FAILED');
        assert.equal(err.reason, 'missing-id');

        return true;
      }
    );
  });

  void it('resolveAll throws SchemaLoadError missing-id when loader returns schema with non-string $id', async () => {
    const registry = new SchemaRegistry();

    registry.set({
      '$id': 'https://ex/Root',
      'properties': { 'ref': { '$ref': 'https://ex/BadId' } },
      'type': 'object'
    });

    const refLoader = new RefResolutionLoader(registry);

    await assert.rejects(
      () => {
        return refLoader.resolveAll(loaderWithMissingId);
      },
      (err: unknown) => {
        assert.ok(err instanceof SchemaLoadError, `expected SchemaLoadError, got: ${String(err)}`);
        assert.equal(err.code, 'SCHEMA_LOAD_FAILED');
        assert.equal(err.reason, 'missing-id');

        return true;
      }
    );
  });
});
