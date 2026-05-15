/**
 * Direct unit tests for SchemaEntryStore.
 *
 * SchemaEntryStore owns the raw Map storage, hash-keyed duplicate index, and
 * monotonic revision counter that back SchemaRegistry. Tests drive the class
 * directly via its public API without involving SchemaRegistry.
 */

import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';
import { SchemaEntryStore } from '../../src/modules/registry/SchemaEntryStore.js';
import { StructuralHash } from '../../src/modules/data/StructuralHash.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEntry(schema: Record<string, unknown>) {
  return {
    'hash': StructuralHash.of(schema),
    schema
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

void describe('SchemaEntryStore', { 'concurrency': true }, () => {
  void it('starts empty with revision 0 and size 0', () => {
    const store = new SchemaEntryStore();

    assert.equal(store.size, 0);
    assert.equal(store.revision, 0);
  });

  void it('add stores entry and increments revision', () => {
    const store = new SchemaEntryStore();
    const schema = {
      '$id': 'https://example.io/A',
      'type': 'object'
    };
    const entry = makeEntry(schema);

    store.add('https://example.io/A', entry);

    assert.equal(store.size, 1);
    assert.equal(store.revision, 1);
    assert.equal(store.has('https://example.io/A'), true);
  });

  void it('get returns the stored entry', () => {
    const store = new SchemaEntryStore();
    const schema = {
      '$id': 'https://example.io/B',
      'type': 'string'
    };
    const entry = makeEntry(schema);

    store.add('https://example.io/B', entry);

    const result = store.get('https://example.io/B');

    assert.ok(result !== undefined);
    assert.deepEqual(result.schema, schema);
  });

  void it('get returns undefined for unknown id', () => {
    const store = new SchemaEntryStore();

    assert.equal(store.get('https://missing.io/X'), undefined);
  });

  void it('has returns false for absent id', () => {
    const store = new SchemaEntryStore();

    assert.equal(store.has('https://missing.io/Z'), false);
  });

  void it('delete removes the entry and increments revision', () => {
    const store = new SchemaEntryStore();
    const schema = {
      '$id': 'https://example.io/C',
      'type': 'number'
    };
    const entry = makeEntry(schema);

    store.add('https://example.io/C', entry);
    const revBefore = store.revision;
    const deleted = store.delete('https://example.io/C');

    assert.equal(deleted, true);
    assert.equal(store.size, 0);
    assert.equal(store.has('https://example.io/C'), false);
    assert.equal(store.revision, revBefore + 1);
  });

  void it('delete returns false for absent id and does not increment revision', () => {
    const store = new SchemaEntryStore();
    const revBefore = store.revision;
    const deleted = store.delete('https://missing.io/W');

    assert.equal(deleted, false);
    assert.equal(store.revision, revBefore);
  });

  void it('clear removes all entries and increments revision', () => {
    const store = new SchemaEntryStore();
    const schemaA = {
      '$id': 'https://example.io/D1',
      'type': 'object'
    };
    const schemaB = {
      '$id': 'https://example.io/D2',
      'type': 'string'
    };

    store.add('https://example.io/D1', makeEntry(schemaA));
    store.add('https://example.io/D2', makeEntry(schemaB));
    const revBefore = store.revision;
    const cleared = store.clear();

    assert.equal(cleared, true);
    assert.equal(store.size, 0);
    assert.equal(store.revision, revBefore + 1);
  });

  void it('clear on an empty store returns false and does not bump revision', () => {
    const store = new SchemaEntryStore();
    const revBefore = store.revision;
    const cleared = store.clear();

    assert.equal(cleared, false);
    assert.equal(store.revision, revBefore);
  });

  void it('add replaces existing entry for the same id (Map.set semantics)', () => {
    const store = new SchemaEntryStore();
    const schemaV1 = {
      '$id': 'https://example.io/E',
      'description': 'v1',
      'type': 'object'
    };
    const schemaV2 = {
      '$id': 'https://example.io/E',
      'description': 'v2',
      'type': 'object'
    };

    store.add('https://example.io/E', makeEntry(schemaV1));
    assert.equal(store.size, 1);

    store.add('https://example.io/E', makeEntry(schemaV2));
    assert.equal(store.size, 1);
    assert.equal(store.revision, 2);

    const stored = store.get('https://example.io/E');

    assert.ok(stored !== undefined);
    assert.equal(stored.schema.description, 'v2');
  });

  void it('hasHash and getByHash reflect the hash index', () => {
    const store = new SchemaEntryStore();
    const schema = {
      '$id': 'https://example.io/F',
      'type': 'boolean'
    };
    const entry = makeEntry(schema);

    store.add('https://example.io/F', entry);

    assert.equal(store.hasHash(entry.hash), true);
    assert.equal(store.getByHash(entry.hash), 'https://example.io/F');
  });

  void it('delete also removes the hash index entry', () => {
    const store = new SchemaEntryStore();
    const schema = {
      '$id': 'https://example.io/G',
      'type': 'integer'
    };
    const entry = makeEntry(schema);

    store.add('https://example.io/G', entry);
    store.delete('https://example.io/G');

    assert.equal(store.hasHash(entry.hash), false);
    assert.equal(store.getByHash(entry.hash), undefined);
  });

  void it('keys() iterates all registered schema ids', () => {
    const store = new SchemaEntryStore();
    const ids = [
      'https://example.io/H1',
      'https://example.io/H2',
      'https://example.io/H3'
    ];

    for (const id of ids) {
      store.add(id, makeEntry({
        '$id': id,
        'type': 'object'
      }));
    }

    const collected = [...store.keys()];

    assert.equal(collected.length, 3);
    for (const id of ids) {
      assert.ok(collected.includes(id), `missing: ${id}`);
    }
  });

  void it('values() iterates all stored entries', () => {
    const store = new SchemaEntryStore();

    store.add('https://example.io/I1', makeEntry({
      '$id': 'https://example.io/I1',
      'type': 'object'
    }));
    store.add('https://example.io/I2', makeEntry({
      '$id': 'https://example.io/I2',
      'type': 'string'
    }));

    const vals = [...store.values()];

    assert.equal(vals.length, 2);
  });

  void it('entries() iterates [id, entry] pairs', () => {
    const store = new SchemaEntryStore();
    const schema = {
      '$id': 'https://example.io/J',
      'type': 'null'
    };
    const entry = makeEntry(schema);

    store.add('https://example.io/J', entry);

    const pairs = [...store.entries()];

    assert.equal(pairs.length, 1);
    assert.equal(pairs[0][0], 'https://example.io/J');
    assert.deepEqual(pairs[0][1].schema, schema);
  });

  void it('findDuplicates detects structurally identical sub-schemas', () => {
    const store = new SchemaEntryStore();

    // NameSchema is the shared shape that gets embedded in OrganizationSchema
    const NameSchema = {
      '$id': 'https://example.io/Name',
      'properties': {
        'first': { 'type': 'string' },
        'last': { 'type': 'string' }
      },
      'type': 'object'
    };

    // OrganizationSchema embeds a property with the same shape as NameSchema (without $id/$ref)
    const OrganizationSchema = {
      '$id': 'https://example.io/Organization',
      'properties': {
        'ceo': {
          'properties': {
            'first': { 'type': 'string' },
            'last': { 'type': 'string' }
          },
          'type': 'object'
        }
      },
      'type': 'object'
    };

    store.add('https://example.io/Name', makeEntry(NameSchema));
    store.add('https://example.io/Organization', makeEntry(OrganizationSchema));

    const duplicates = store.findDuplicates();

    assert.ok(duplicates.length > 0, 'expected duplicate entries to be detected');
    const dup = duplicates[0];

    assert.ok(typeof dup.schemaId === 'string');
    assert.ok(typeof dup.pointer === 'string');
    assert.ok(typeof dup.equivalentTo === 'string');
  });

  void it('findDuplicates returns empty array when no structural overlaps exist', () => {
    const store = new SchemaEntryStore();

    store.add('https://example.io/K1', makeEntry({
      '$id': 'https://example.io/K1',
      'type': 'string'
    }));
    store.add('https://example.io/K2', makeEntry({
      '$id': 'https://example.io/K2',
      'type': 'number'
    }));

    const duplicates = store.findDuplicates();

    assert.equal(duplicates.length, 0);
  });

  void it('revision increments monotonically across add/delete/clear', () => {
    const store = new SchemaEntryStore();
    const revisions: number[] = [store.revision];

    store.add('https://example.io/L', makeEntry({ 'type': 'object' }));
    revisions.push(store.revision);

    store.delete('https://example.io/L');
    revisions.push(store.revision);

    store.add('https://example.io/L', makeEntry({ 'type': 'object' }));
    revisions.push(store.revision);

    store.clear();
    revisions.push(store.revision);

    for (let i = 1; i < revisions.length; i++) {
      assert.ok(
        revisions[i] > revisions[i - 1],
        `revision did not increase at step ${i}: ${revisions[i - 1]} → ${revisions[i]}`
      );
    }
  });
});
