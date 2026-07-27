/**
 * Direct unit tests for ReferenceResolutionLoader.
 *
 * ReferenceResolutionLoader takes a SchemaRegistryInterface and a loader function, then
 * eagerly resolves all transitive $ref IRIs into the registry. Tests use a real
 * SchemaRegistry as the registry surface and drive the loader via stub functions.
 */

import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';
import { SchemaRegistry } from '../../src/modules/registry/SchemaRegistry.js';
import { ReferenceResolutionLoader } from '../../src/modules/registry/ReferenceResolutionLoader.js';
import { GraphError } from '../../src/errors/GraphError.js';
import type { JsonSchemaType } from '../../src/types/Schema.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRegistry() {
  return new SchemaRegistry();
}

function makeLoader(map: Record<string, JsonSchemaType | null>): (iri: string) => Promise<JsonSchemaType | null> {
  return async (iri) => {
    return map[iri] ?? null;
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

void describe('ReferenceResolutionLoader', { 'concurrency': false }, () => {
  void it('loadRootIds skips IRIs already registered in the registry', async () => {
    const registry = makeRegistry();
    const schema: JsonSchemaType = {
      '$id': 'https://example.io/Pre',
      'type': 'string'
    };

    registry.set(schema);

    let callCount = 0;
    const loader = async (_: string): Promise<JsonSchemaType | null> => {
      callCount++;

      return null;
    };

    const referenceLoader = new ReferenceResolutionLoader(registry);

    await referenceLoader.loadRootIds(['https://example.io/Pre'], loader);

    assert.equal(callCount, 0, 'loader must not be called for already-registered IRI');
    assert.equal(registry.has('https://example.io/Pre'), true);
  });

  void it('loadRootIds registers a schema returned by the loader', async () => {
    const registry = makeRegistry();
    const referenceLoader = new ReferenceResolutionLoader(registry);
    const schema: JsonSchemaType = {
      '$id': 'https://example.io/Loaded',
      'type': 'number'
    };

    await referenceLoader.loadRootIds(['https://example.io/Loaded'], makeLoader({ 'https://example.io/Loaded': schema }));

    assert.equal(registry.has('https://example.io/Loaded'), true);
  });

  void it('loadRootIds throws GraphError REF_UNRESOLVED when loader returns null', async () => {
    const registry = makeRegistry();
    const referenceLoader = new ReferenceResolutionLoader(registry);

    await assert.rejects(
      () => {
        return referenceLoader.loadRootIds(['https://example.io/Missing'], makeLoader({}));
      },
      (err: unknown) => {
        assert.ok(err instanceof GraphError, `expected GraphError, got: ${String(err)}`);
        assert.equal(err.code, 'REF_UNRESOLVED');

        return true;
      }
    );
  });

  void it('loadRootIds handles multiple IRIs, calling loader for each unregistered one', async () => {
    const registry = makeRegistry();
    const preloaded: JsonSchemaType = {
      '$id': 'https://example.io/P1',
      'type': 'string'
    };

    registry.set(preloaded);

    const schema2: JsonSchemaType = {
      '$id': 'https://example.io/P2',
      'type': 'boolean'
    };
    const referenceLoader = new ReferenceResolutionLoader(registry);

    await referenceLoader.loadRootIds(
      [
        'https://example.io/P1',
        'https://example.io/P2'
      ],
      makeLoader({ 'https://example.io/P2': schema2 })
    );

    assert.equal(registry.has('https://example.io/P1'), true);
    assert.equal(registry.has('https://example.io/P2'), true);
  });

  void it('resolveAll registers schemas for all $ref IRIs in registered schemas', async () => {
    const registry = makeRegistry();

    // Root schema references RefTarget
    const rootSchema: JsonSchemaType = {
      '$id': 'https://example.io/Root',
      'properties': { 'item': { '$ref': 'https://example.io/RefTarget' } },
      'type': 'object'
    };
    const refTarget: JsonSchemaType = {
      '$id': 'https://example.io/RefTarget',
      'type': 'string'
    };

    registry.set(rootSchema);

    const referenceLoader = new ReferenceResolutionLoader(registry);

    await referenceLoader.resolveAll(makeLoader({ 'https://example.io/RefTarget': refTarget }));

    assert.equal(registry.has('https://example.io/RefTarget'), true);
  });

  void it('resolveAll handles transitive $ref chains (a refs b refs c)', async () => {
    const registry = makeRegistry();

    const schemaA: JsonSchemaType = {
      '$id': 'https://example.io/A',
      'properties': { 'b': { '$ref': 'https://example.io/B' } },
      'type': 'object'
    };
    const schemaB: JsonSchemaType = {
      '$id': 'https://example.io/B',
      'properties': { 'c': { '$ref': 'https://example.io/C' } },
      'type': 'object'
    };
    const schemaC: JsonSchemaType = {
      '$id': 'https://example.io/C',
      'type': 'integer'
    };

    registry.set(schemaA);

    const referenceLoader = new ReferenceResolutionLoader(registry);

    await referenceLoader.resolveAll(makeLoader({
      'https://example.io/B': schemaB,
      'https://example.io/C': schemaC
    }));

    assert.equal(registry.has('https://example.io/B'), true);
    assert.equal(registry.has('https://example.io/C'), true);
  });

  void it('resolveAll throws GraphError REF_UNRESOLVED for a $ref the loader cannot resolve', async () => {
    const registry = makeRegistry();

    const rootSchema: JsonSchemaType = {
      '$id': 'https://example.io/WithBroken',
      'properties': { 'x': { '$ref': 'https://example.io/Broken' } },
      'type': 'object'
    };

    registry.set(rootSchema);

    const referenceLoader = new ReferenceResolutionLoader(registry);

    await assert.rejects(
      () => {
        return referenceLoader.resolveAll(makeLoader({}));
      },
      (err: unknown) => {
        assert.ok(err instanceof GraphError, `expected GraphError, got: ${String(err)}`);
        assert.equal(err.code, 'REF_UNRESOLVED');

        return true;
      }
    );
  });

  void it('resolveAll handles cyclic $ref without infinite loop (a refs b refs a)', async () => {
    const registry = makeRegistry();

    const schemaA: JsonSchemaType = {
      '$id': 'https://example.io/Cyclic/A',
      'properties': { 'b': { '$ref': 'https://example.io/Cyclic/B' } },
      'type': 'object'
    };
    const schemaB: JsonSchemaType = {
      '$id': 'https://example.io/Cyclic/B',
      'properties': { 'a': { '$ref': 'https://example.io/Cyclic/A' } },
      'type': 'object'
    };

    registry.set(schemaA);

    const referenceLoader = new ReferenceResolutionLoader(registry);

    // Should resolve without hanging or throwing: B loads from loader, A is already registered
    await assert.doesNotReject(async () => {
      await referenceLoader.resolveAll(makeLoader({ 'https://example.io/Cyclic/B': schemaB }));
    });

    assert.equal(registry.has('https://example.io/Cyclic/B'), true);
  });

  void it('resolveAll is a no-op for an empty registry', async () => {
    const registry = makeRegistry();
    const referenceLoader = new ReferenceResolutionLoader(registry);
    let loaderCalled = false;

    await referenceLoader.resolveAll(async (_) => {
      loaderCalled = true;

      return null;
    });

    assert.equal(loaderCalled, false);
  });

  void it('resolveAll skips schemas where all $ref values are already in the registry (snapshot integration)', async () => {
    const registry = makeRegistry();

    const shared: JsonSchemaType = {
      '$id': 'https://example.io/Shared',
      'type': 'string'
    };
    const root: JsonSchemaType = {
      '$id': 'https://example.io/RootSnap',
      'properties': { 's': { '$ref': 'https://example.io/Shared' } },
      'type': 'object'
    };

    // Pre-register both — loader should never be called
    registry.set(shared);
    registry.set(root);

    const referenceLoader = new ReferenceResolutionLoader(registry);
    let loaderCalled = false;

    await referenceLoader.resolveAll(async (_) => {
      loaderCalled = true;

      return null;
    });

    assert.equal(loaderCalled, false, 'loader must not be called when all refs are already registered');
  });
});
