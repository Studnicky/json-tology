import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { Lift } from '../../src/modules/rdf/Lift.js';
import { SchemaRegistry } from '../../src/modules/registry/SchemaRegistry.js';

// Smoke test: Lift.instances returns an empty array for an unknown schema ID.
// The deprecated fromExternalQuad / fromExternalRdfJsQuad path has been removed;
// callers should use Lists.narrowExternalQuads(quads) + Lift.instances().

void describe('Lift', { 'concurrency': true }, () => {
  void it('instances returns empty array for unknown schema ID', () => {
    const registry = new SchemaRegistry();
    const result = Lift.instances('https://example.com/Unknown', [], registry);

    assert.deepEqual(result, []);
  });

  void it('instances returns empty array when no quads are provided', () => {
    const registry = new SchemaRegistry();

    registry.set({
      '$id': 'https://example.com/User',
      'properties': { 'name': { 'type': 'string' } },
      'type': 'object'
    });

    const result = Lift.instances('https://example.com/User', [], registry);

    assert.deepEqual(result, []);
  });
});
