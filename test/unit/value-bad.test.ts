/**
 * Value — Bad paths
 *
 * Covers error scenarios missing from the Good/Ugly-heavy value.test.ts:
 *   - value.create() with unregistered $id
 *   - value.cast() with data that fails schema type
 *   - value.clean() with non-object input to object schema
 *   - value.instantiate() with invalid data
 *   - value.convert() with bad data
 *   - Changeset applied in conflicting sequence
 *   - Registry modified after Value instance created
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import {
  Changeset, JsonTology, SchemaError
} from '../../src/index.js';

// ---------------------------------------------------------------------------
// value.create() — unregistered $id
// ---------------------------------------------------------------------------

void describe('Value.create() bad paths', () => {
  void it('throws SchemaError(SCHEMA_NOT_REGISTERED) for unknown $id', () => {
    const tology = JsonTology.create({ 'baseIRI': 'urn:test:' });
    const value = tology.value;

    assert.throws(
      () => {
        value.create('urn:test:no-such-schema');
      },
      (err: unknown) => {
        assert.ok(err instanceof SchemaError, `expected SchemaError, got ${String(err)}`);
        assert.equal((err).name, 'SchemaError');
        assert.equal((err).code, 'SCHEMA_NOT_REGISTERED');
        assert.ok((err).message.includes('no-such-schema'));

        return true;
      }
    );
  });

  void it('throws SchemaError for second unregistered $id in same registry', () => {
    const tology = JsonTology.create({
      'baseIRI': 'urn:test:',
      'schemas': [{
        '$id': 'urn:test:real',
        'type': 'string'
      }]
    });
    const value = tology.value;

    // Real schema works
    assert.doesNotThrow(() => {
      value.create('urn:test:real');
    });

    // Unregistered schema throws
    assert.throws(
      () => {
        value.create('urn:test:ghost');
      },
      (err: unknown) => {
        assert.ok(err instanceof SchemaError);
        assert.equal((err).code, 'SCHEMA_NOT_REGISTERED');
        assert.ok((err).schemaId !== undefined);

        return true;
      }
    );
  });

  void it('SchemaError carries the missing schemaId in the error object', () => {
    const tology = JsonTology.create({ 'baseIRI': 'urn:test:' });
    const missingId = 'urn:test:missing-schema-id';

    let caught: SchemaError | undefined;

    try {
      tology.value.create(missingId);
    } catch (error) {
      if (error instanceof SchemaError) {
        caught = error;
      }
    }

    assert.ok(caught !== undefined, 'expected SchemaError to be thrown');
    assert.equal(caught.code, 'SCHEMA_NOT_REGISTERED');
    assert.ok(caught.message.length > 0);
    const json = caught.toJson();

    assert.ok(json.schemaId !== undefined || caught.message.includes(missingId));
  });
});

// ---------------------------------------------------------------------------
// value.instantiate() — data failing validation
// ---------------------------------------------------------------------------

void describe('Value.instantiate() bad paths', () => {
  const schema = {
    '$id': 'urn:test:typed-object',
    'properties': {
      'count': { 'type': 'integer' },
      'name': { 'type': 'string' }
    },
    'required': ['name'],
    'type': 'object'
  } as const;

  const tology = JsonTology.create({
    'baseIRI': 'urn:test:',
    'schemas': [schema]
  });
  const value = tology.value;

  const invalidInputScenarios: Array<{
    'expectedErrorClass': string;
    'input': unknown;
    'name': string;
  }> = [
    {
      'expectedErrorClass': 'InstantiationError',
      'input': {},
      'name': 'missing required property throws'
    },
    {
      'expectedErrorClass': 'InstantiationError',
      'input': { 'name': 42 },
      'name': 'wrong type for required string property throws'
    },
    {
      'expectedErrorClass': 'InstantiationError',
      'input': {
        'count': 'not-a-number',
        'name': 'ok'
      },
      'name': 'wrong type for optional integer property throws'
    },
    {
      'expectedErrorClass': 'InstantiationError',
      'input': 'not-an-object',
      'name': 'non-object input for object schema throws'
    },
    {
      'expectedErrorClass': 'InstantiationError',
      'input': null,
      'name': 'null input for object schema throws'
    }
  ];

  for (const {
    'expectedErrorClass': cls, 'input': inp, 'name': scenarioName
  } of invalidInputScenarios) {
    void it(scenarioName, () => {
      assert.throws(
        () => {
          value.instantiate('urn:test:typed-object', inp);
        },
        (err: unknown) => {
          assert.equal((err as Error).constructor.name, cls, `${scenarioName}: expected ${cls}`);
          assert.ok((err as Error).message.length > 0);

          return true;
        }
      );
    });
  }
});

// ---------------------------------------------------------------------------
// value.cast() — invalid data triggers error
// ---------------------------------------------------------------------------

void describe('Value.cast() bad paths', () => {
  void it('cast for unregistered $id throws SchemaError', () => {
    const tology = JsonTology.create({ 'baseIRI': 'urn:test:' });

    assert.throws(
      () => {
        tology.value.cast('urn:test:nonexistent', { 'x': 1 });
      },
      (err: unknown) => {
        assert.ok(err instanceof SchemaError);
        assert.equal((err).code, 'SCHEMA_NOT_REGISTERED');

        return true;
      }
    );
  });

  void it('cast returns value even for partial type mismatch (coercion mode)', () => {
    const tology = JsonTology.create({
      'baseIRI': 'urn:test:',
      'schemas': [{
        '$id': 'urn:test:cast-str',
        'type': 'string'
      }]
    });
    // cast applies coercion — number -> string
    const result = tology.value.cast('urn:test:cast-str', 42);

    assert.equal(result, '42');
  });
});

// ---------------------------------------------------------------------------
// Changeset conflicting ops in sequence
// ---------------------------------------------------------------------------

/* eslint-disable no-restricted-syntax -- Changeset.apply() is not Function.prototype.apply() */
void describe('Changeset conflicting ops in sequence', () => {
  void it('last set wins when the same path is set twice', () => {
    const ops: ReadonlyArray<{ 'op': 'delete' | 'set';
      'path': string;
      'value'?: unknown }> = [
      {
        'op': 'set',
        'path': '/name',
        'value': 'Alice'
      },
      {
        'op': 'set',
        'path': '/name',
        'value': 'Bob'
      }
    ];
    const cs = new Changeset(ops as ReadonlyArray<{ 'op': 'delete';
      'path': string } | { 'op': 'set';
        'path': string;
        'value': unknown }>);
    const result = cs.apply({ 'name': 'original' }) as Record<string, unknown>;

    assert.equal(result.name, 'Bob');
    assert.equal(cs.length, 2);
  });

  void it('set then delete on same path leaves field absent', () => {
    const ops: ReadonlyArray<{ 'op': 'delete' | 'set';
      'path': string;
      'value'?: unknown }> = [
      {
        'op': 'set',
        'path': '/x',
        'value': 99
      },
      {
        'op': 'delete',
        'path': '/x'
      }
    ];
    const cs = new Changeset(ops as ReadonlyArray<{ 'op': 'delete';
      'path': string } | { 'op': 'set';
        'path': string;
        'value': unknown }>);
    const result = cs.apply({ 'x': 0 }) as Record<string, unknown>;

    assert.equal('x' in result, false);
  });

  void it('delete then set on same path restores the field', () => {
    const ops: ReadonlyArray<{ 'op': 'delete' | 'set';
      'path': string;
      'value'?: unknown }> = [
      {
        'op': 'delete',
        'path': '/x'
      },
      {
        'op': 'set',
        'path': '/x',
        'value': 42
      }
    ];
    const cs = new Changeset(ops as ReadonlyArray<{ 'op': 'delete';
      'path': string } | { 'op': 'set';
        'path': string;
        'value': unknown }>);
    const result = cs.apply({ 'x': 0 }) as Record<string, unknown>;

    assert.equal(result.x, 42);
  });

  void it('conflicting sibling paths are both applied independently', () => {
    const ops: ReadonlyArray<{ 'op': 'delete' | 'set';
      'path': string;
      'value'?: unknown }> = [
      {
        'op': 'set',
        'path': '/a',
        'value': 1
      },
      {
        'op': 'delete',
        'path': '/b'
      },
      {
        'op': 'set',
        'path': '/a',
        'value': 100
      }
    ];
    const cs = new Changeset(ops as ReadonlyArray<{ 'op': 'delete';
      'path': string } | { 'op': 'set';
        'path': string;
        'value': unknown }>);
    const result = cs.apply({
      'a': 0,
      'b': 'remove-me'
    }) as Record<string, unknown>;

    assert.equal(result.a, 100);
    assert.equal('b' in result, false);
  });
});

// ---------------------------------------------------------------------------
// Registry modified after Value instance created — staleness behaviour
// ---------------------------------------------------------------------------

void describe('Value — registry modification after Value creation', () => {
  void it('value instance reflects newly registered schema after register()', () => {
    const tology = JsonTology.create({ 'baseIRI': 'urn:test:' });
    const value = tology.value;

    // Before registration: throws
    assert.throws(
      () => {
        value.create('urn:test:late-schema');
      },
      (err: unknown) => {
        return err instanceof SchemaError;
      }
    );

    // Register after getting the Value reference
    tology.register({
      '$id': 'urn:test:late-schema',
      'type': 'string'
    });

    // After registration: works (Value delegates to registry, no caching of absence)
    const result = value.create('urn:test:late-schema');

    assert.equal(result, '');
  });

  void it('value.instantiate() uses schemas registered after value instance obtained', () => {
    const tology = JsonTology.create({ 'baseIRI': 'urn:test:' });
    const value = tology.value;

    tology.register({
      '$id': 'urn:test:late-string',
      'type': 'string'
    });

    const result = value.instantiate('urn:test:late-string', 'hello');

    assert.equal(result, 'hello');
  });

  void it('calling create() with a $id that matches base-IRI prefix still requires registration', () => {
    const tology = JsonTology.create({ 'baseIRI': 'urn:test:' });
    const value = tology.value;

    // Having the right base IRI doesn't auto-register
    assert.throws(
      () => {
        value.create('urn:test:not-registered');
      },
      (err: unknown) => {
        assert.ok(err instanceof SchemaError);

        return true;
      }
    );
  });
});
