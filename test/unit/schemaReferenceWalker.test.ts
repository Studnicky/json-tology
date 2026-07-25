/**
 * Direct unit tests for SchemaReferenceWalker.
 *
 * SchemaReferenceWalker is a stateless tree walker that collects cross-schema $ref
 * IRIs from a JSON Schema tree. Registry state — including the embedded-$id set,
 * which the caller derives from the canonical graph — is injected via parameters,
 * so the walker has no external dependencies and performs no embedded-id walk of
 * its own. Tests exercise the public API only: collectRefsInNode, assertResolvable,
 * and collectUnresolved.
 */

import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';
import { SchemaReferenceWalker } from '../../src/modules/registry/SchemaReferenceWalker.js';
import { SchemaGraph } from '../../src/modules/graph/SchemaGraph.js';
import { GraphError } from '../../src/errors/GraphError.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function noKnown(_: string): boolean {
  return false;
}

function identityResolve(id: string): string {
  return id;
}

function knownSet(ids: string[]): (id: string) => boolean {
  const s = new Set(ids);

  return (id) => {
    return s.has(id);
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

void describe('SchemaReferenceWalker', { 'concurrency': true }, () => {
  const walker = new SchemaReferenceWalker();

  // -------------------------------------------------------------------------
  // collectRefsInNode
  // -------------------------------------------------------------------------

  void it('collectRefsInNode collects a plain cross-schema $ref', () => {
    const schema = { '$ref': 'https://example.io/Other' };
    const embeddedIds = new Set<string>();
    const out = new Set<string>();

    walker.collectRefsInNode(schema, embeddedIds, out, noKnown, identityResolve);

    assert.ok(out.has('https://example.io/Other'));
  });

  void it('collectRefsInNode skips fragment-only $ref (starts with #)', () => {
    const schema = { '$ref': '#/$defs/Local' };
    const embeddedIds = new Set<string>();
    const out = new Set<string>();

    walker.collectRefsInNode(schema, embeddedIds, out, noKnown, identityResolve);

    assert.equal(out.size, 0);
  });

  void it('collectRefsInNode strips fragment from cross-schema $ref with fragment', () => {
    const schema = { '$ref': 'https://example.io/Other#/defs/Sub' };
    const embeddedIds = new Set<string>();
    const out = new Set<string>();

    walker.collectRefsInNode(schema, embeddedIds, out, noKnown, identityResolve);

    assert.ok(out.has('https://example.io/Other'), `out = ${JSON.stringify([...out])}`);
  });

  void it('collectRefsInNode skips $ref when already known', () => {
    const schema = { '$ref': 'https://example.io/Known' };
    const embeddedIds = new Set<string>();
    const out = new Set<string>();

    walker.collectRefsInNode(schema, embeddedIds, out, knownSet(['https://example.io/Known']), identityResolve);

    assert.equal(out.size, 0);
  });

  void it('collectRefsInNode skips $ref when in embeddedIds', () => {
    const schema = { '$ref': 'https://example.io/Embedded' };
    const embeddedIds = new Set(['https://example.io/Embedded']);
    const out = new Set<string>();

    walker.collectRefsInNode(schema, embeddedIds, out, noKnown, identityResolve);

    assert.equal(out.size, 0);
  });

  void it('collectRefsInNode collects $ref values in nested composition', () => {
    const schema = {
      'allOf': [
        { '$ref': 'https://example.io/Base' },
        { 'properties': { 'x': { '$ref': 'https://example.io/Prop' } } }
      ]
    };
    const embeddedIds = new Set<string>();
    const out = new Set<string>();

    walker.collectRefsInNode(schema, embeddedIds, out, noKnown, identityResolve);

    assert.ok(out.has('https://example.io/Base'));
    assert.ok(out.has('https://example.io/Prop'));
  });

  void it('collectRefsInNode produces empty set for a schema with no $ref', () => {
    const schema = {
      'properties': { 'name': { 'type': 'string' } },
      'type': 'object'
    };
    const embeddedIds = new Set<string>();
    const out = new Set<string>();

    walker.collectRefsInNode(schema, embeddedIds, out, noKnown, identityResolve);

    assert.equal(out.size, 0);
  });

  // -------------------------------------------------------------------------
  // assertResolvable
  // -------------------------------------------------------------------------

  void it('assertResolvable does not throw when all $ref values are known', () => {
    const schema = { '$ref': 'https://example.io/Resolved' };
    const embeddedIds = new Set<string>();

    assert.doesNotThrow(() => {
      walker.assertResolvable(schema, 'https://example.io/Parent', embeddedIds, knownSet(['https://example.io/Resolved']), identityResolve);
    });
  });

  void it('assertResolvable throws GraphError REF_UNRESOLVED for missing cross-schema $ref', () => {
    const schema = { '$ref': 'https://example.io/Missing' };
    const embeddedIds = new Set<string>();

    assert.throws(
      () => {
        walker.assertResolvable(schema, 'https://example.io/Parent', embeddedIds, noKnown, identityResolve);
      },
      (err: unknown) => {
        assert.ok(err instanceof GraphError, `expected GraphError, got: ${String(err)}`);
        assert.equal(err.code, 'REF_UNRESOLVED');

        return true;
      }
    );
  });

  void it('assertResolvable does not throw for fragment-only $ref (local anchor)', () => {
    const schema = { '$ref': '#/$defs/LocalType' };
    const embeddedIds = new Set<string>();

    assert.doesNotThrow(() => {
      walker.assertResolvable(schema, 'https://example.io/Parent', embeddedIds, noKnown, identityResolve);
    });
  });

  void it('assertResolvable does not throw for schema with no $ref', () => {
    const schema = {
      'properties': { 'x': { 'type': 'string' } },
      'type': 'object'
    };
    const embeddedIds = new Set<string>();

    assert.doesNotThrow(() => {
      walker.assertResolvable(schema, 'https://example.io/Parent', embeddedIds, noKnown, identityResolve);
    });
  });

  // -------------------------------------------------------------------------
  // collectUnresolved
  // -------------------------------------------------------------------------

  void it('collectUnresolved returns unresolved IRIs', () => {
    const schema = {
      '$ref': 'https://example.io/Missing',
      'type': 'object'
    };

    const unresolved = walker.collectUnresolved(schema, new Set(), noKnown, identityResolve);

    assert.ok(unresolved.has('https://example.io/Missing'));
  });

  void it('collectUnresolved returns empty set when all refs are known', () => {
    const schema = {
      '$ref': 'https://example.io/Known',
      'type': 'object'
    };

    const unresolved = walker.collectUnresolved(
      schema,
      new Set(),
      knownSet(['https://example.io/Known']),
      identityResolve
    );

    assert.equal(unresolved.size, 0);
  });

  void it('collectUnresolved returns empty set for schema with no cross-schema refs', () => {
    const schema = {
      'properties': { 'id': { 'type': 'string' } },
      'type': 'object'
    };

    const unresolved = walker.collectUnresolved(schema, new Set(), noKnown, identityResolve);

    assert.equal(unresolved.size, 0);
  });

  void it('collectUnresolved excludes refs that match graph-derived embedded $id values', () => {
    const schema = {
      '$defs': {
        'Inner': {
          '$id': 'https://example.io/Inner',
          'type': 'string'
        }
      },
      '$id': 'https://example.io/Root',
      '$ref': 'https://example.io/Inner'
    };

    // Embedded ids come solely from the canonical graph index.
    const embeddedIds = new Set(new SchemaGraph(schema).embeddedSchemaIds());
    const unresolved = walker.collectUnresolved(schema, embeddedIds, noKnown, identityResolve);

    // Inner is embedded in the same document, so it should not be unresolved
    assert.equal(unresolved.has('https://example.io/Inner'), false);
    assert.ok(embeddedIds.has('https://example.io/Inner'), 'graph exposes the embedded Inner $id');
  });
});
