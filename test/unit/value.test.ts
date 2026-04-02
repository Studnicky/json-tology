/**
 * Value utility tests — clone, hash, diff, patch, cast, clean
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { SchemaRegistry } from '../../src/modules/registry/SchemaRegistry.js';
import { Value } from '../../src/modules/data/value.js';
import { Changeset } from '../../src/modules/data/changeset.js';

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------

void describe('Value.create()', () => {
  const primitiveScenarios: Array<{
    'expected': unknown;
    'name': string;
    'schemaId': string;
    'schemaObj': Record<string, unknown>;
  }> = [
    {
      'expected': '',
      'name': 'creates default string',
      'schemaId': 'urn:test:string',
      'schemaObj': {
        '$id': 'urn:test:string',
        'type': 'string'
      }
    },
    {
      'expected': 0,
      'name': 'creates default number',
      'schemaId': 'urn:test:number',
      'schemaObj': {
        '$id': 'urn:test:number',
        'type': 'number'
      }
    },
    {
      'expected': 0,
      'name': 'creates default integer',
      'schemaId': 'urn:test:integer',
      'schemaObj': {
        '$id': 'urn:test:integer',
        'type': 'integer'
      }
    },
    {
      'expected': false,
      'name': 'creates default boolean',
      'schemaId': 'urn:test:boolean',
      'schemaObj': {
        '$id': 'urn:test:boolean',
        'type': 'boolean'
      }
    },
    {
      'expected': null,
      'name': 'creates default null',
      'schemaId': 'urn:test:null',
      'schemaObj': {
        '$id': 'urn:test:null',
        'type': 'null'
      }
    },
    {
      'expected': [],
      'name': 'creates default array',
      'schemaId': 'urn:test:array',
      'schemaObj': {
        '$id': 'urn:test:array',
        'items': { 'type': 'string' },
        'type': 'array'
      }
    }
  ];

  for (const {
    'expected': exp, 'name': scenarioName, 'schemaId': id, 'schemaObj': schema
  } of primitiveScenarios) {
    void it(scenarioName, () => {
      const registry = new SchemaRegistry();

      registry.register(schema);
      const value = new Value(registry);

      assert.deepEqual(value.create(id), exp);
    });
  }

  const defaultScenarios: Array<{
    'expected': unknown;
    'name': string;
    'schemaId': string;
    'schemas': ReadonlyArray<Record<string, unknown>>;
  }> = [
    {
      'expected': {
        'age': 0,
        'name': 'anonymous',
        'nested': { 'flag': true }
      },
      'name': 'creates object with nested defaults and $ref',
      'schemaId': 'urn:test:nested-object',
      'schemas': [
        {
          '$id': 'urn:test:nested-inner',
          'properties': {
            'flag': {
              'default': true,
              'type': 'boolean'
            }
          },
          'type': 'object'
        },
        {
          '$id': 'urn:test:nested-object',
          'properties': {
            'age': { 'type': 'number' },
            'name': {
              'default': 'anonymous',
              'type': 'string'
            },
            'nested': { '$ref': 'urn:test:nested-inner' }
          },
          'required': [
            'age',
            'nested'
          ],
          'type': 'object'
        }
      ]
    },
    {
      'expected': 'hello',
      'name': 'honors explicit string default',
      'schemaId': 'urn:test:string-default',
      'schemas': [{
        '$id': 'urn:test:string-default',
        'default': 'hello',
        'type': 'string'
      }]
    },
    {
      'expected': 42,
      'name': 'honors explicit number default',
      'schemaId': 'urn:test:number-default',
      'schemas': [{
        '$id': 'urn:test:number-default',
        'default': 42,
        'type': 'number'
      }]
    },
    {
      'expected': 'fixed',
      'name': 'honors const value',
      'schemaId': 'urn:test:const',
      'schemas': [{
        '$id': 'urn:test:const',
        'const': 'fixed'
      }]
    },
    {
      'expected': 'a',
      'name': 'honors enum first value',
      'schemaId': 'urn:test:enum',
      'schemas': [{
        '$id': 'urn:test:enum',
        'enum': [
          'a',
          'b',
          'c'
        ]
      }]
    },
    {
      'expected': null,
      'name': 'returns null for no-type schema',
      'schemaId': 'urn:test:empty',
      'schemas': [{ '$id': 'urn:test:empty' }]
    }
  ];

  for (const {
    'expected': exp, 'name': scenarioName, 'schemaId': id, 'schemas': schemaList
  } of defaultScenarios) {
    void it(scenarioName, () => {
      const registry = new SchemaRegistry();

      for (const schema of schemaList) {
        registry.register(schema);
      }
      const value = new Value(registry);

      assert.deepEqual(value.create(id), exp);
    });
  }

  void it('creates required properties but omits optional ones', () => {
    const registry = new SchemaRegistry();

    registry.register({
      '$id': 'urn:test:required-props',
      'properties': {
        'id': { 'type': 'string' },
        'optional': { 'type': 'number' }
      },
      'required': ['id'],
      'type': 'object'
    } as const);
    const value = new Value(registry);
    const result = value.create('urn:test:required-props') as Record<string, unknown>;

    assert.equal(result.id, '');
    assert.equal('optional' in result, false);
  });
});

// ---------------------------------------------------------------------------
// clone + hash
// ---------------------------------------------------------------------------

void describe('Value.clone() and Value.hash()', () => {
  const cloneScenarios: Array<{
    'check': (cloned: unknown, original: unknown) => void;
    'input': unknown;
    'name': string;
  }> = [
    {
      'check': (cloned, original) => {
        assert.deepEqual(cloned, original);
        assert.notEqual(cloned, original);
        assert.notEqual(
          (cloned as Record<string, unknown>).b,
          (original as Record<string, unknown>).b
        );
      },
      'input': {
        'a': 1,
        'b': { 'c': 2 }
      },
      'name': 'deep-clones objects with nested structure'
    },
    {
      'check': (cloned, original) => {
        assert.deepEqual(cloned, original);
        assert.notEqual(cloned, original);
      },
      'input': [
        1,
        [
          2,
          3
        ]
      ],
      'name': 'deep-clones nested arrays'
    },
    {
      'check': (cloned) => {
        assert.equal(cloned, 42);
      },
      'input': 42,
      'name': 'passes through number primitive'
    },
    {
      'check': (cloned) => {
        assert.equal(cloned, 'hello');
      },
      'input': 'hello',
      'name': 'passes through string primitive'
    },
    {
      'check': (cloned) => {
        assert.equal(cloned, true);
      },
      'input': true,
      'name': 'passes through boolean primitive'
    },
    {
      'check': (cloned) => {
        assert.equal(cloned, null);
      },
      'input': null,
      'name': 'passes through null'
    },
    {
      'check': (cloned, original) => {
        assert.deepEqual(cloned, []);
        assert.notEqual(cloned, original);
      },
      'input': [],
      'name': 'clones empty array'
    },
    {
      'check': (cloned, original) => {
        assert.deepEqual(cloned, {});
        assert.notEqual(cloned, original);
      },
      'input': {},
      'name': 'clones empty object'
    }
  ];

  for (const {
    'check': checkFn, 'input': inp, 'name': scenarioName
  } of cloneScenarios) {
    void it(scenarioName, () => {
      const cloned = Value.clone(inp);

      checkFn(cloned, inp);
    });
  }

  const hashScenarios: Array<{
    'check': () => void;
    'name': string;
  }> = [
    {
      'check': () => {
        assert.equal(typeof Value.hash({ 'a': 1 }), 'string');
      },
      'name': 'produces a string'
    },
    {
      'check': () => {
        assert.equal(
          Value.hash({
            'a': 1,
            'b': 2
          }),
          Value.hash({
            'a': 1,
            'b': 2
          })
        );
      },
      'name': 'is deterministic for identical objects'
    },
    {
      'check': () => {
        assert.notEqual(Value.hash({ 'a': 1 }), Value.hash({ 'a': 2 }));
      },
      'name': 'differs for different values'
    },
    {
      'check': () => {
        assert.equal(Value.hash(42), Value.hash(42));
      },
      'name': 'is deterministic for identical primitives'
    },
    {
      'check': () => {
        assert.notEqual(Value.hash(42), Value.hash('42'));
      },
      'name': 'is type-sensitive (number vs string)'
    },
    {
      'check': () => {
        assert.equal(Value.hash({}), Value.hash({}));
      },
      'name': 'produces consistent hash for empty object'
    },
    {
      'check': () => {
        assert.equal(Value.hash([]), Value.hash([]));
      },
      'name': 'produces consistent hash for empty array'
    },
    {
      'check': () => {
        assert.notEqual(Value.hash({}), Value.hash([]));
      },
      'name': 'distinguishes empty object from empty array'
    }
  ];

  for (const {
    'check': checkFn, 'name': scenarioName
  } of hashScenarios) {
    void it(scenarioName, () => {
      checkFn();
    });
  }
});

// ---------------------------------------------------------------------------
// diff / patch
// ---------------------------------------------------------------------------

void describe('Value.diff() -> Changeset', () => {
  const diffScenarios: Array<{
    'a': unknown;
    'b': unknown;
    'expectedOps': Array<{ 'op': string;
      'path': string;
      'value'?: unknown }>;
    'name': string;
  }> = [
    {
      'a': { 'a': 1 },
      'b': { 'a': 1 },
      'expectedOps': [],
      'name': 'identical objects produce empty changeset'
    },
    {
      'a': { 'a': 1 },
      'b': { 'a': 2 },
      'expectedOps': [{
        'op': 'set',
        'path': '/a',
        'value': 2
      }],
      'name': 'detects set operation for changed value'
    },
    {
      'a': {
        'a': 1,
        'b': 2
      },
      'b': { 'a': 1 },
      'expectedOps': [{
        'op': 'delete',
        'path': '/b'
      }],
      'name': 'detects delete operation for removed key'
    },
    {
      'a': { 'a': 1 },
      'b': {
        'a': 1,
        'b': 2
      },
      'expectedOps': [{
        'op': 'set',
        'path': '/b',
        'value': 2
      }],
      'name': 'detects set operation for added key'
    },
    {
      'a': { 'user': { 'name': 'Alice' } },
      'b': { 'user': { 'name': 'Bob' } },
      'expectedOps': [{
        'op': 'set',
        'path': '/user/name',
        'value': 'Bob'
      }],
      'name': 'detects nested changes'
    },
    {
      'a': { 'x': 42 },
      'b': { 'x': 'forty-two' },
      'expectedOps': [{
        'op': 'set',
        'path': '/x',
        'value': 'forty-two'
      }],
      'name': 'detects type change on same key (number to string)'
    },
    {
      'a': { 'data': { 'a': 1 } },
      'b': {
        'data': [
          1,
          2
        ]
      },
      'expectedOps': [{
        'op': 'set',
        'path': '/data',
        'value': [
          1,
          2
        ]
      }],
      'name': 'detects type change on same key (object to array)'
    }
  ];

  for (const {
    'a': before, 'b': after, 'expectedOps': expected, 'name': scenarioName
  } of diffScenarios) {
    void it(scenarioName, () => {
      const cs = Value.diff(before, after);

      if (expected.length === 0) {
        assert.equal(cs.isEmpty, true);
        assert.equal(cs.length, 0);
      } else {
        assert.equal(cs.length, expected.length);
        for (const [
          idx,
          element
        ] of expected.entries()) {
          assert.equal(cs.operations[idx].op, element.op);
          assert.equal(cs.operations[idx].path, element.path);
          if ('value' in element) {
            assert.deepEqual(
              (cs.operations[idx] as { 'value': unknown }).value,
              element.value
            );
          }
        }
      }
    });
  }

  const roundTripScenarios: Array<{
    'a': Record<string, unknown>;
    'b': Record<string, unknown>;
    'name': string;
  }> = [
    {
      'a': {
        'name': 'Alice',
        'role': 'user'
      },
      'b': { 'name': 'Bob' },
      'name': 'round-trips simple set and delete'
    },
    {
      'a': {
        'x': 1,
        'y': 2,
        'z': { 'w': 3 }
      },
      'b': {
        'x': 10,
        'z': {
          'q': 4,
          'w': 99
        }
      },
      'name': 'round-trips nested changes with add and delete'
    }
  ];

  for (const {
    'a': before, 'b': after, 'name': scenarioName
  } of roundTripScenarios) {
    void it(scenarioName, () => {
      const changeset = Value.diff(before, after);
      let patched: unknown = Value.clone(before);

      for (const operation of changeset.operations) {
        patched = Value.applyOp(patched, operation);
      }

      assert.deepEqual(patched, after);
    });
  }

  void it('does not mutate original during patch', () => {
    const orig = { 'x': 1 };
    const changeset = Value.diff(orig, { 'x': 2 });
    let patched: unknown = Value.clone(orig);

    for (const operation of changeset.operations) {
      patched = Value.applyOp(patched, operation);
    }

    assert.equal(orig.x, 1);
  });
});

// ---------------------------------------------------------------------------
// cast
// ---------------------------------------------------------------------------

void describe('Value.cast()', () => {
  const registry = new SchemaRegistry();

  registry.register({
    '$id': 'urn:test:number',
    'type': 'number'
  } as const);
  registry.register({
    '$id': 'urn:test:string',
    'type': 'string'
  } as const);
  registry.register({
    '$id': 'urn:test:boolean',
    'type': 'boolean'
  } as const);
  registry.register({
    '$id': 'urn:test:item',
    'properties': {
      'count': { 'type': 'integer' },
      'flag': { 'type': 'boolean' },
      'name': { 'type': 'string' },
      'score': {
        'default': 0,
        'type': 'number'
      }
    },
    'type': 'object'
  } as const);
  registry.register({
    '$defs': {
      'metrics': {
        'properties': {
          'count': {
            'default': 0,
            'type': 'integer'
          }
        },
        'type': 'object'
      }
    },
    '$id': 'urn:test:ref-metrics',
    'properties': { 'metrics': { '$ref': '#/$defs/metrics' } },
    'type': 'object'
  } as const);
  const value = new Value(registry);

  const castScenarios: Array<{
    'expected': unknown;
    'input': unknown;
    'name': string;
    'schemaId': string;
  }> = [
    {
      'expected': 42,
      'input': '42',
      'name': 'coerces string to number',
      'schemaId': 'urn:test:number'
    },
    {
      'expected': '123',
      'input': 123,
      'name': 'coerces number to string',
      'schemaId': 'urn:test:string'
    },
    {
      'expected': true,
      'input': 'true',
      'name': 'coerces string to boolean',
      'schemaId': 'urn:test:boolean'
    },
    {
      'expected': {
        'name': 'Widget',
        'score': 0
      },
      'input': { 'name': 'Widget' },
      'name': 'fills object defaults on cast',
      'schemaId': 'urn:test:item'
    },
    {
      'expected': {
        'count': 5,
        'name': 'Widget',
        'score': 0
      },
      'input': {
        'count': '5',
        'name': 'Widget'
      },
      'name': 'coerces string count to integer in object',
      'schemaId': 'urn:test:item'
    },
    {
      'expected': { 'metrics': { 'count': 5 } },
      'input': { 'metrics': { 'count': '5' } },
      'name': 'resolves $ref nested defaults via graph-engine',
      'schemaId': 'urn:test:ref-metrics'
    },
    {
      'expected': { 'metrics': { 'count': 0 } },
      'input': {},
      'name': 'fills $ref nested defaults for empty object',
      'schemaId': 'urn:test:ref-metrics'
    }
  ];

  for (const {
    'expected': exp, 'input': inp, 'name': scenarioName, 'schemaId': id
  } of castScenarios) {
    void it(scenarioName, () => {
      const result = value.cast(id, inp);

      assert.deepEqual(result, exp);
    });
  }

  void it('casts null to an object for object schemas', () => {
    assert.ok(typeof value.cast('urn:test:item', null) === 'object');
  });
});

// ---------------------------------------------------------------------------
// clean
// ---------------------------------------------------------------------------

void describe('Value.clean()', () => {
  const registry = new SchemaRegistry();

  registry.register({
    '$id': 'urn:test:address',
    'properties': { 'street': { 'type': 'string' } },
    'type': 'object'
  } as const);
  registry.register({
    '$id': 'urn:test:user',
    'properties': {
      'address': { '$ref': 'urn:test:address' },
      'email': { 'type': 'string' },
      'name': { 'type': 'string' }
    },
    'type': 'object'
  } as const);
  const value = new Value(registry);

  const cleanScenarios: Array<{
    'expected': Record<string, unknown>;
    'input': Record<string, unknown>;
    'name': string;
    'schemaId': string;
  }> = [
    {
      'expected': {
        'email': 'a@b.com',
        'name': 'Alice'
      },
      'input': {
        'email': 'a@b.com',
        'name': 'Alice',
        'secret': 'x'
      },
      'name': 'removes undeclared properties and preserves declared ones',
      'schemaId': 'urn:test:user'
    },
    {
      'expected': {
        'address': { 'street': '1 Main St' },
        'name': 'Alice'
      },
      'input': {
        'address': {
          'hack': 'x',
          'street': '1 Main St'
        },
        'name': 'Alice'
      },
      'name': 'recurses into $ref objects to strip undeclared properties',
      'schemaId': 'urn:test:user'
    },
    {
      'expected': {},
      'input': {
        'city': 'Portland',
        'zip': '97201'
      },
      'name': 'strips all properties when none are declared',
      'schemaId': 'urn:test:address'
    }
  ];

  for (const {
    'expected': exp, 'input': inp, 'name': scenarioName, 'schemaId': id
  } of cleanScenarios) {
    void it(scenarioName, () => {
      const result = value.clean(id, inp);

      assert.deepEqual(result, exp);
    });
  }

  void it('does not mutate the original input', () => {
    const input = {
      'name': 'Alice',
      'secret': 'x'
    };

    value.clean('urn:test:user', input);
    assert.ok('secret' in input);
  });
});

// ---------------------------------------------------------------------------
// applyOp edge cases (folded from operations.test.ts)
// ---------------------------------------------------------------------------

void describe('Value.applyOp() edge cases', () => {
  const applyOpScenarios: Array<{
    'expected': unknown;
    'input': unknown;
    'name': string;
    'operation': { 'op': string;
      'path': string;
      'value'?: unknown };
  }> = [
    {
      'expected': { 'b': 2 },
      'input': { 'a': 1 },
      'name': 'set at root replaces the whole value',
      'operation': {
        'op': 'set',
        'path': '/',
        'value': { 'b': 2 }
      }
    },
    {
      'expected': undefined,
      'input': { 'a': 1 },
      'name': 'delete at root returns undefined',
      'operation': {
        'op': 'delete',
        'path': '/'
      }
    },
    {
      'expected': {
        'items': [
          'a',
          'c'
        ]
      },
      'input': {
        'items': [
          'a',
          'b',
          'c'
        ]
      },
      'name': 'delete with array path splices elements',
      'operation': {
        'op': 'delete',
        'path': '/items/1'
      }
    }
  ];

  for (const {
    'expected': exp, 'input': inp, 'name': scenarioName, 'operation': op
  } of applyOpScenarios) {
    void it(scenarioName, () => {
      const result = Value.applyOp(inp, op as { 'op': 'delete';
        'path': string } | { 'op': 'set';
          'path': string;
          'value': unknown });

      assert.deepEqual(result, exp);
    });
  }

  void it('does not mutate original array', () => {
    const original = {
      'items': [
        1,
        2,
        3
      ]
    };

    Value.applyOp(original, {
      'op': 'delete',
      'path': '/items/0'
    });
    assert.deepEqual(original.items, [
      1,
      2,
      3
    ]);
  });
});

// ---------------------------------------------------------------------------
// Changeset (folded from changeset.test.ts)
// ---------------------------------------------------------------------------

/* eslint-disable no-restricted-syntax -- Changeset.apply() is not Function.prototype.apply() */
void describe('Changeset', () => {
  const applyScenarios: Array<{
    'expected': Record<string, unknown>;
    'input': Record<string, unknown>;
    'name': string;
    'operations': ReadonlyArray<{ 'op': 'delete' | 'set';
      'path': string;
      'value'?: unknown }>;
  }> = [
    {
      'expected': { 'name': 'Bob' },
      'input': {
        'age': 30,
        'name': 'Alice'
      },
      'name': 'apply sets and deletes properties',
      'operations': [
        {
          'op': 'set',
          'path': '/name',
          'value': 'Bob'
        },
        {
          'op': 'delete',
          'path': '/age'
        }
      ]
    },
    {
      'expected': {
        'address': {
          'city': 'Portland',
          'zip': '98101'
        }
      },
      'input': {
        'address': {
          'city': 'Seattle',
          'zip': '98101'
        }
      },
      'name': 'apply handles nested paths',
      'operations': [{
        'op': 'set',
        'path': '/address/city',
        'value': 'Portland'
      }]
    },
    {
      'expected': {
        'x': 10,
        'y': 20
      },
      'input': {
        'x': 1,
        'y': 2,
        'z': 3
      },
      'name': 'apply chains multiple operations',
      'operations': [
        {
          'op': 'set',
          'path': '/x',
          'value': 10
        },
        {
          'op': 'set',
          'path': '/y',
          'value': 20
        },
        {
          'op': 'delete',
          'path': '/z'
        }
      ]
    }
  ];

  for (const {
    'expected': exp, 'input': inp, 'name': scenarioName, 'operations': ops
  } of applyScenarios) {
    void it(scenarioName, () => {
      const cs = new Changeset(ops as ReadonlyArray<{ 'op': 'delete';
        'path': string } | { 'op': 'set';
          'path': string;
          'value': unknown }>);
      const result = cs.apply(inp);

      assert.deepEqual(result, exp);
    });
  }

  void it('does not mutate original on apply', () => {
    const cs = new Changeset([
      {
        'op': 'set',
        'path': '/name',
        'value': 'Bob'
      },
      {
        'op': 'delete',
        'path': '/age'
      }
    ]);
    const original = {
      'age': 30,
      'name': 'Alice'
    };

    cs.apply(original);
    assert.equal(original.name, 'Alice');
    assert.equal(original.age, 30);
  });

  const metaScenarios: Array<{
    'isEmpty': boolean;
    'length': number;
    'name': string;
    'operations': ReadonlyArray<{ 'op': 'delete' | 'set';
      'path': string;
      'value'?: unknown }>;
  }> = [
    {
      'isEmpty': true,
      'length': 0,
      'name': 'empty changeset has isEmpty=true and length=0',
      'operations': []
    },
    {
      'isEmpty': false,
      'length': 2,
      'name': 'non-empty changeset has isEmpty=false and correct length',
      'operations': [
        {
          'op': 'set',
          'path': '/a',
          'value': 1
        },
        {
          'op': 'delete',
          'path': '/b'
        }
      ]
    }
  ];

  for (const {
    'isEmpty': empty, 'length': len, 'name': scenarioName, 'operations': ops
  } of metaScenarios) {
    void it(scenarioName, () => {
      const cs = new Changeset(ops as ReadonlyArray<{ 'op': 'delete';
        'path': string } | { 'op': 'set';
          'path': string;
          'value': unknown }>);

      assert.equal(cs.isEmpty, empty);
      assert.equal(cs.length, len);
    });
  }
});

// ---------------------------------------------------------------------------
// Value.diff() with arrays
// ---------------------------------------------------------------------------

void describe('Value.diff() -> Changeset (arrays)', () => {
  const arrayDiffScenarios: Array<{
    'a': Record<string, unknown>;
    'b': Record<string, unknown>;
    'check': (cs: Changeset) => void;
    'name': string;
  }> = [
    {
      'a': {
        'items': [
          1,
          2,
          3
        ]
      },
      'b': {
        'items': [
          1,
          99,
          3
        ]
      },
      'check': (cs) => {
        assert.equal(cs.isEmpty, false);
        assert.equal(
          cs.operations.some((op) => {
            return op.path === '/items/1' && op.op === 'set' && op.value === 99;
          }),
          true
        );
      },
      'name': 'detects modified array items'
    },
    {
      'a': { 'items': ['a'] },
      'b': {
        'items': [
          'a',
          'b',
          'c'
        ]
      },
      'check': (cs) => {
        const setOps = cs.operations.filter((op) => {
          return op.op === 'set';
        });

        assert.ok(setOps.some((op) => {
          return op.path === '/items/1' && op.value === 'b';
        }));
        assert.ok(setOps.some((op) => {
          return op.path === '/items/2' && op.value === 'c';
        }));
      },
      'name': 'detects added array items (array grew)'
    },
    {
      'a': {
        'items': [
          1,
          2,
          3
        ]
      },
      'b': { 'items': [1] },
      'check': (cs) => {
        const delOps = cs.operations.filter((op) => {
          return op.op === 'delete';
        });

        assert.ok(delOps.some((op) => {
          return op.path === '/items/1';
        }));
        assert.ok(delOps.some((op) => {
          return op.path === '/items/2';
        }));
      },
      'name': 'detects removed array items (array shrank)'
    },
    {
      'a': {
        'items': [
          1,
          2
        ]
      },
      'b': {
        'items': [
          1,
          2
        ]
      },
      'check': (cs) => {
        assert.equal(cs.isEmpty, true);
      },
      'name': 'identical arrays produce empty changeset'
    }
  ];

  for (const {
    'a': before, 'b': after, 'check': checkFn, 'name': scenarioName
  } of arrayDiffScenarios) {
    void it(scenarioName, () => {
      const cs = Value.diff(before, after);

      checkFn(cs);
    });
  }
});
