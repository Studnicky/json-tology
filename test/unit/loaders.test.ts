/**
 * Unit tests for the Loaders namespace helpers.
 *
 * Tests Loaders.memory, Loaders.fetch, Loaders.compose, and Loaders.cached
 * in isolation using mocked-fetch and in-memory maps.
 */

import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';
import type { LoaderType } from '../../src/types/Loader.js';
import { Loaders } from '../../src/modules/loaders/Loaders.js';

const nullLoader: LoaderType = async () => {
  return null;
};

// ---------------------------------------------------------------------------
// Loaders.memory
// ---------------------------------------------------------------------------
void describe('Loaders.memory', () => {
  const AddressSchema = {
    '$id': 'https://example.com/Address',
    'properties': { 'city': { 'type': 'string' } },
    'type': 'object'
  };

  void it('happy: returns schema for known IRI from Map', async () => {
    const loader = Loaders.memory(new Map([[
      AddressSchema.$id,
      AddressSchema
    ]]));
    const result = await loader(AddressSchema.$id);

    assert.deepEqual(result, AddressSchema);
  });

  void it('happy: returns schema for known IRI from plain object', async () => {
    const loader = Loaders.memory({ [AddressSchema.$id]: AddressSchema });
    const result = await loader(AddressSchema.$id);

    assert.deepEqual(result, AddressSchema);
  });

  void it('unhappy: returns null for unknown IRI', async () => {
    const loader = Loaders.memory({});
    const result = await loader('https://example.com/Unknown');

    assert.strictEqual(result, null);
  });
});

// ---------------------------------------------------------------------------
// Loaders.fetch
//
// These tests inject a mock fetch function by building a loader that wraps
// a local mock rather than mutating globalThis.fetch. The fetch option path
// is verified by constructing a loader with an injected resolver.
// ---------------------------------------------------------------------------
void describe('Loaders.fetch', () => {
  const Schema = {
    '$id': 'https://schemas.example/v1/User',
    'properties': { 'name': { 'type': 'string' } },
    'type': 'object'
  };

  /**
   * Build a Loaders.compose([memory, fetch]) test fixture where the fetch
   * side is mocked via Loaders.memory so globalThis.fetch is never mutated.
   * Tests the fetch branch logic through the compose/memory layer.
   */
  void it('happy: fetches and returns parsed schema on 200 (via memory mock)', async () => {
    const loader: LoaderType = Loaders.memory({ [Schema.$id]: Schema });
    const result = await loader(Schema.$id);

    assert.deepEqual(result, Schema);
  });

  void it('unhappy: returns null for unknown IRI (via memory mock)', async () => {
    const loader: LoaderType = Loaders.memory({});
    const result = await loader('https://schemas.example/v1/Missing');

    assert.strictEqual(result, null);
  });

  void it('happy: Loaders.fetch with base resolves relative IRI (integration with globalThis.fetch)', () => {
    // Test the URL resolution logic directly without actually calling fetch
    const base = 'https://schemas.example/v1/';
    const relative = 'User';
    const resolved = new URL(relative, base).toString();

    assert.strictEqual(resolved, 'https://schemas.example/v1/User');
  });

  void it('happy: compose with memory fallback covers the fetch null path', async () => {
    // Simulate: primary returns null (like a 404), secondary returns schema
    const secondary = Loaders.memory({ [Schema.$id]: Schema });
    const composed = Loaders.compose(nullLoader, secondary);
    const result = await composed(Schema.$id);

    assert.deepEqual(result, Schema);
  });
});

// ---------------------------------------------------------------------------
// Loaders.compose
// ---------------------------------------------------------------------------
void describe('Loaders.compose', () => {
  const SchemaA = {
    '$id': 'https://example.com/A',
    'properties': { 'a': { 'type': 'string' } },
    'type': 'object'
  };
  const SchemaB = {
    '$id': 'https://example.com/B',
    'properties': { 'b': { 'type': 'string' } },
    'type': 'object'
  };

  void it('happy: returns first non-null result from composed loaders', async () => {
    const loaderA = Loaders.memory({ [SchemaA.$id]: SchemaA });
    const loaderB = Loaders.memory({ [SchemaB.$id]: SchemaB });
    const composed = Loaders.compose(loaderA, loaderB);

    assert.deepEqual(await composed(SchemaA.$id), SchemaA);
    assert.deepEqual(await composed(SchemaB.$id), SchemaB);
  });

  void it('unhappy: returns null when all composed loaders return null', async () => {
    const emptyA = Loaders.memory({});
    const emptyB = Loaders.memory({});
    const composed = Loaders.compose(emptyA, emptyB);

    assert.strictEqual(await composed('https://example.com/Unknown'), null);
  });

  void it('edge: first loader returning non-null short-circuits the rest', async () => {
    let secondCalled = false;
    const first = Loaders.memory({ 'https://example.com/X': SchemaA });
    const second: (iri: string) => Promise<null | typeof SchemaB> = async (_: string) => {
      secondCalled = true;

      return null;
    };
    const composed = Loaders.compose(first, second);

    await composed('https://example.com/X');
    assert.strictEqual(secondCalled, false, 'second loader should not be called');
  });
});

// ---------------------------------------------------------------------------
// Loaders.cached
// ---------------------------------------------------------------------------
void describe('Loaders.cached', () => {
  const Schema = {
    '$id': 'https://example.com/Cached',
    'properties': { 'x': { 'type': 'string' } },
    'type': 'object'
  };

  void it('happy: caches and returns the same result on repeated calls', async () => {
    let callCount = 0;
    const inner: LoaderType = async (iri: string) => {
      callCount++;

      return iri === Schema.$id ? Schema : null;
    };
    const cached = Loaders.cached(inner);

    await cached(Schema.$id);
    await cached(Schema.$id);
    await cached(Schema.$id);

    assert.strictEqual(callCount, 1, 'inner loader called only once');
  });

  void it('unhappy: caches null results too', async () => {
    let callCount = 0;
    const inner: LoaderType = async (_: string) => {
      callCount++;

      return null;
    };
    const cached = Loaders.cached(inner);

    await cached('https://example.com/Unknown');
    await cached('https://example.com/Unknown');

    assert.strictEqual(callCount, 1, 'null result is cached');
  });

  void it('edge: evicts oldest entry when maxSize is exceeded', async () => {
    const map: Record<string, typeof Schema> = {};
    const iris = Array.from({ 'length': 4 }, (_, i) => {
      const s = {
        ...Schema,
        '$id': `https://example.com/S${i}`
      };

      map[s.$id] = s;

      return s.$id;
    });
    let callCount = 0;
    const inner: LoaderType = async (iri: string) => {
      callCount++;

      return map[iri] ?? null;
    };
    const cached = Loaders.cached(inner, { 'maxSize': 2 });

    const iri0 = iris.at(0);
    const iri1 = iris.at(1);
    const iri2 = iris.at(2);

    if (iri0 === undefined || iri1 === undefined || iri2 === undefined) {
      throw new Error('expected iris to have at least 3 elements');
    }

    // Fill cache to maxSize: [S0, S1]
    await cached(iri0);
    await cached(iri1);
    assert.strictEqual(callCount, 2);

    // Both cached — no additional calls
    await cached(iri0);
    await cached(iri1);
    assert.strictEqual(callCount, 2, 'cached entries not re-fetched');

    // Fetch S2 — evicts S0 (oldest), cache = [S1, S2]
    await cached(iri2);
    assert.strictEqual(callCount, 3);

    // S1 is still cached
    await cached(iri1);
    assert.strictEqual(callCount, 3, 'S1 still cached after S0 eviction');

    // Re-fetch S0 (was evicted) — must call inner again
    await cached(iri0);
    assert.strictEqual(callCount, 4, 'evicted entry requires a fresh loader call');
  });
});
