// CURIE round-trip: a schema authored with a CURIE $id must register and be
// reachable through every lookup path, because the registry expands CURIEs on
// the read side. The canonical store key is the absolute IRI; CURIEs are
// authoring shorthand normalized at the registration boundary.

import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';
import { JsonTology } from '../../src/index.js';
import { SchemaRegistry } from '../../src/modules/registry/SchemaRegistry.js';

const PREFIXES = { 'ex': 'https://ex.io/' };
const CANONICAL_FOO = 'https://ex.io/Foo';

const FooSchema = {
  '$id': 'ex:Foo',
  'properties': { 'id': { 'type': 'string' } },
  'required': ['id'],
  'type': 'object'
} as const;

const BarSchema = {
  '$id': 'ex:Bar',
  'properties': { 'foo': { '$ref': 'ex:Foo' } },
  'type': 'object'
} as const;

function makeRegistry(): SchemaRegistry {
  return new SchemaRegistry({ 'prefixes': PREFIXES });
}

void describe('CURIE $id registration', { 'concurrency': true }, () => {
  void it('stores a CURIE $id under its canonical absolute IRI', () => {
    const registry = makeRegistry();

    registry.set(FooSchema as Record<string, unknown>);

    assert.deepEqual([...registry.keys()], [CANONICAL_FOO]);
    assert.equal(registry.get('ex:Foo')?.$id, CANONICAL_FOO, 'stored $id is stamped canonical');
  });

  void it('reports has() true for both the CURIE and the expanded IRI', () => {
    const registry = makeRegistry();

    registry.set(FooSchema as Record<string, unknown>);

    assert.equal(registry.has('ex:Foo'), true, 'has(CURIE)');
    assert.equal(registry.has(CANONICAL_FOO), true, 'has(absolute)');
  });

  void it('instantiates by CURIE id, expanded id, and schema object alike', () => {
    const registry = makeRegistry();

    registry.set(FooSchema as Record<string, unknown>);

    assert.deepEqual(registry.instantiate('ex:Foo', { 'id': 'a' }), { 'id': 'a' });
    assert.deepEqual(registry.instantiate(CANONICAL_FOO, { 'id': 'b' }), { 'id': 'b' });
    assert.deepEqual(
      registry.instantiate(FooSchema as Record<string, unknown> & { '$id': string }, { 'id': 'c' }),
      { 'id': 'c' }
    );
  });

  void it('validates and is()-checks by CURIE id', () => {
    const registry = makeRegistry();

    registry.set(FooSchema as Record<string, unknown>);

    assert.equal(registry.validate('ex:Foo', { 'id': 'a' }).length, 0, 'valid by CURIE');
    assert.equal(registry.validate('ex:Foo', {}).length > 0, true, 'missing required by CURIE');
    assert.equal(registry.is('ex:Foo', { 'id': 'a' }), true, 'is() by CURIE');
  });

  void it('deletes by CURIE id', () => {
    const registry = makeRegistry();

    registry.set(FooSchema as Record<string, unknown>);

    assert.equal(registry.delete('ex:Foo'), true, 'delete reports removal');
    assert.equal(registry.has(CANONICAL_FOO), false, 'gone after delete');
  });

  void it('resolves a CURIE $ref against a CURIE-registered $id', () => {
    const registry = makeRegistry();

    registry.set(FooSchema as Record<string, unknown>);
    registry.set(BarSchema as Record<string, unknown>);

    assert.deepEqual(
      registry.instantiate('ex:Bar', { 'foo': { 'id': 'a' } }),
      { 'foo': { 'id': 'a' } }
    );
  });

  void it('accepts a keyed set() whose key and CURIE $id denote the same schema', () => {
    const registry = makeRegistry();

    registry.set(FooSchema as Record<string, unknown>, CANONICAL_FOO);

    assert.equal(registry.has('ex:Foo'), true, 'keyed by absolute, found by CURIE');
  });

  void it('runs an invariant registered under a CURIE id', () => {
    const registry = makeRegistry();

    registry.set(FooSchema as Record<string, unknown>);
    registry.addInvariant('ex:Foo', {
      'fn': (value: unknown) => {
        return (value as { 'id'?: string }).id === 'forbidden' ? 'id must not be "forbidden"' : null;
      },
      'name': 'forbidId'
    });

    assert.equal(registry.validate('ex:Foo', { 'id': 'ok' }).length, 0, 'invariant passes');
    assert.equal(registry.validate('ex:Foo', { 'id': 'forbidden' }).length, 1, 'invariant fires by CURIE');
  });
});

void describe('CURIE $id facade integration', { 'concurrency': true }, () => {
  void it('applies a computed field on a CURIE-registered schema', () => {
    const ComputedSchema = {
      '$id': 'ex:Tagged',
      'properties': {
        'name': { 'type': 'string' },
        'tag': {
          'jt:computed': true,
          'type': 'string'
        }
      },
      'required': ['name'],
      'type': 'object'
    } as const;

    const jt = JsonTology.create({
      'baseIri': 'https://ex.io',
      'computeds': {
        'ex:Tagged': {
          'tag': (data: Record<string, unknown>) => {
            return `tag:${data.name as string}`;
          }
        }
      },
      'enableStrictGraph': false,
      'prefixes': PREFIXES,
      'schemas': [ComputedSchema] as const
    });

    const result = jt.instantiate('ex:Tagged', { 'name': 'x' }) as Record<string, unknown>;

    assert.equal(result.tag, 'tag:x', 'computed field resolved under CURIE id');
  });
});

void describe('absolute and urn ids are unaffected', { 'concurrency': true }, () => {
  void it('keeps an absolute IRI $id verbatim', () => {
    const registry = makeRegistry();
    const schema = {
      '$id': 'https://other.example/Thing',
      'properties': { 'id': { 'type': 'string' } },
      'required': ['id'],
      'type': 'object'
    } as const;

    registry.set(schema as Record<string, unknown>);

    assert.deepEqual([...registry.keys()], ['https://other.example/Thing']);
    assert.deepEqual(registry.instantiate('https://other.example/Thing', { 'id': 'a' }), { 'id': 'a' });
  });

  void it('keeps a urn: $id verbatim', () => {
    const registry = makeRegistry();
    const schema = {
      '$id': 'urn:bookstore:Book',
      'properties': { 'id': { 'type': 'string' } },
      'required': ['id'],
      'type': 'object'
    } as const;

    registry.set(schema as Record<string, unknown>);

    assert.deepEqual([...registry.keys()], ['urn:bookstore:Book']);
    assert.deepEqual(registry.instantiate('urn:bookstore:Book', { 'id': 'a' }), { 'id': 'a' });
  });
});
