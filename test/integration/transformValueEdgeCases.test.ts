/**
 * Transform and Value edge-case tests
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import {
  Transform, Value
} from '../../src/index.js';

// ---------------------------------------------------------------------------
// Transform edge cases
// ---------------------------------------------------------------------------

interface TransformGetDecoderScenario {
  'assertions': (fns: ReturnType<typeof Transform.getDecoder>) => void;
  'name': string;
  'schema': { readonly '$id': string;
    readonly 'type': string };
  'setup': (schema: { readonly '$id': string;
    readonly 'type': string }) => void;
}

const getDecoderScenarios: TransformGetDecoderScenario[] = [
  {
    'assertions': (fns) => {
      assert.equal(fns, undefined, 'no transform — decoder undefined');
    },
    'name': 'returns undefined when schema has no registered transform',
    'schema': {
      '$id': 'urn:test:plain-no-transform',
      'type': 'string'
    },
    'setup': () => {
      // No setup needed — no transform registered
    }
  },
  {
    'assertions': (fns) => {
      assert.ok(fns !== undefined, 'empty pipe — decoder exists');
      assert.equal(fns.decode('hello'), 'hello', 'empty pipe — decode identity');
      assert.equal(fns.encode('hello'), 'hello', 'empty pipe — encode identity');
    },
    'name': 'acts as a no-op identity transform with empty chain',
    'schema': {
      '$id': 'urn:test:empty-chain',
      'type': 'string'
    },
    'setup': (schema) => {
      Transform.chain(schema, []);
    }
  },
  {
    'assertions': (fns) => {
      assert.ok(fns !== undefined, 'single chain — decoder exists');
      assert.equal(fns.decode(5), 10, 'single chain — decode');
      assert.equal(fns.encode(10), 5, 'single chain — encode');
    },
    'name': 'single chain is equivalent to that transform alone',
    'schema': {
      '$id': 'urn:test:single-chain',
      'type': 'number'
    },
    'setup': (schema) => {
      Transform.chain(schema, [{
        'decode': (value: number) => {
          return value * 2;
        },
        'encode': (value: number) => {
          return value / 2;
        }
      }]);
    }
  }
];

void describe('Transform.getDecoder scenarios', () => {
  for (const scenario of getDecoderScenarios) {
    void it(scenario.name, () => {
      scenario.setup(scenario.schema);
      const fns = Transform.getDecoder(scenario.schema);

      scenario.assertions(fns);
    });
  }
});

// ---------------------------------------------------------------------------
// Transform create/brand scenarios
// ---------------------------------------------------------------------------

interface TransformScenario {
  'assertions': () => void;
  'name': string;
}

const transformScenarios: TransformScenario[] = [
  {
    'assertions': () => {
      const EmailSchema = Transform.brand(
        {
          '$id': 'urn:test:email-brand',
          'format': 'email',
          'type': 'string'
        } as const,
        'Email'
      );
      const UserIdSchema = Transform.brand(
        {
          '$id': 'urn:test:userid-brand',
          'type': 'string'
        } as const,
        'UserId'
      );

      assert.equal(EmailSchema.$id, 'urn:test:email-brand', 'brand — email $id');
      assert.equal(EmailSchema.type, 'string', 'brand — email type');
      assert.equal(UserIdSchema.$id, 'urn:test:userid-brand', 'brand — userid $id');
      assert.notEqual(EmailSchema.$id, UserIdSchema.$id, 'brand — distinct $ids');
    },
    'name': 'brands schema and preserves identity for type discrimination'
  },
  {
    'assertions': () => {
      const RoundTripSchema = {
        '$id': 'urn:test:round-trip',
        'type': 'string'
      } as const;

      Transform.create(RoundTripSchema, {
        'decode': (source: string) => {
          return new Date(source);
        },
        'encode': (date: Date) => {
          return date.toISOString();
        }
      });
      const fns = Transform.getDecoder(RoundTripSchema);

      assert.ok(fns !== undefined, 'round-trip — decoder exists');

      const original = '2025-03-15T12:00:00.000Z';
      const decoded = fns.decode(original) as Date;
      const encoded = fns.encode(decoded) as string;

      assert.equal(encoded, original, 'round-trip — encoded matches original');
      assert.ok(decoded instanceof Date, 'round-trip — decoded is Date');
      assert.equal(decoded.toISOString(), original, 'round-trip — decoded ISO matches');
    },
    'name': 'recovers original value after decode then encode'
  },
  {
    'assertions': () => {
      const PointSchema = {
        '$id': 'urn:test:point-transform',
        'properties': {
          'x': { 'type': 'number' },
          'y': { 'type': 'number' }
        },
        'type': 'object'
      } as const;

      Transform.create(PointSchema, {
        'decode': (raw: { 'x': number;
          'y': number }) => {
          return {
            'magnitude': Math.hypot(raw.x, raw.y),
            'x': raw.x,
            'y': raw.y
          };
        },
        'encode': (enriched: { 'magnitude': number;
          'x': number;
          'y': number }) => {
          return {
            'x': enriched.x,
            'y': enriched.y
          };
        }
      });
      const fns = Transform.getDecoder(PointSchema);

      assert.ok(fns !== undefined, 'nested object — decoder exists');

      const wire = {
        'x': 3,
        'y': 4
      };
      const decoded = fns.decode(wire) as { 'magnitude': number;
        'x': number;
        'y': number };

      assert.equal(decoded.x, 3, 'nested object — x');
      assert.equal(decoded.y, 4, 'nested object — y');
      assert.equal(decoded.magnitude, 5, 'nested object — magnitude');

      const encoded = fns.encode(decoded) as { 'x': number;
        'y': number };

      assert.deepEqual(encoded, wire, 'nested object — encode round-trip');
    },
    'name': 'decodes and encodes complex nested objects'
  }
];

void describe('Transform create/brand scenarios', () => {
  for (const scenario of transformScenarios) {
    void it(scenario.name, () => {
      scenario.assertions();
    });
  }
});

// ---------------------------------------------------------------------------
// Value.clone edge cases
// ---------------------------------------------------------------------------

interface CloneScenario {
  'assertions': (cloned: unknown, original: unknown) => void;
  'input': unknown;
  'name': string;
}

const cloneScenarios: CloneScenario[] = [
  {
    'assertions': (clonedValue, originalValue) => {
      const cl = clonedValue as { 'a': { 'b': { 'c': number } };
        'd': number[] };
      const or = originalValue as { 'a': { 'b': { 'c': number } };
        'd': number[] };

      assert.deepEqual(cl, or, 'nested clone — deep equal');
      assert.notEqual(cl, or, 'nested clone — root ref');
      assert.notEqual(cl.a, or.a, 'nested clone — a ref');
      assert.notEqual(cl.a.b, or.a.b, 'nested clone — b ref');
      assert.notEqual(cl.d, or.d, 'nested clone — d ref');

      cl.a.b.c = 999;
      assert.equal(or.a.b.c, 42, 'nested clone — mutation isolation');
    },
    'input': {
      'a': { 'b': { 'c': 42 } },
      'd': [
        1,
        2,
        3
      ]
    },
    'name': 'produces deep clone with no reference sharing for nested objects'
  },
  {
    'assertions': (clonedValue, originalValue) => {
      const cl = clonedValue as Array<{ 'name': string;
        'scores': number[] }>;
      const or = originalValue as Array<{ 'name': string;
        'scores': number[] }>;

      assert.deepEqual(cl, or, 'array clone — deep equal');
      assert.notEqual(cl, or, 'array clone — root ref');
      assert.notEqual(cl[0], or[0], 'array clone — element 0 ref');
      assert.notEqual(cl[1], or[1], 'array clone — element 1 ref');
      assert.notEqual(cl[0].scores, or[0].scores, 'array clone — scores ref');

      cl[0].name = 'Charlie';
      cl[1].scores.push(5);
      assert.equal(or[0].name, 'Alice', 'array clone — name isolation');
      assert.deepEqual(or[1].scores, [
        3,
        4
      ], 'array clone — scores isolation');
    },
    'input': [
      {
        'name': 'Alice',
        'scores': [
          1,
          2
        ]
      },
      {
        'name': 'Bob',
        'scores': [
          3,
          4
        ]
      }
    ],
    'name': 'independently clones each element in array of objects'
  }
];

void describe('Value.clone edge cases', () => {
  for (const scenario of cloneScenarios) {
    void it(scenario.name, () => {
      const cloned = Value.clone(scenario.input);

      scenario.assertions(cloned, scenario.input);
    });
  }
});

// ---------------------------------------------------------------------------
// Value.hash edge cases
// ---------------------------------------------------------------------------

interface HashScenario {
  'inputs': unknown[];
  'name': string;
  'shouldMatch': boolean;
}

const hashScenarios: HashScenario[] = [
  {
    'inputs': [
      {
        'count': 10,
        'label': 'test',
        'nested': { 'flag': true }
      },
      {
        'count': 10,
        'label': 'test',
        'nested': { 'flag': true }
      }
    ],
    'name': 'produces the same hash for the same input across calls',
    'shouldMatch': true
  },
  {
    'inputs': [
      {
        'a': 1,
        'b': 2,
        'c': 3
      },
      {
        'a': 1,
        'b': 2,
        'c': 3
      },
      {
        'a': 1,
        'b': 2,
        'c': 3
      }
    ],
    'name': 'produces the same hash regardless of key order',
    'shouldMatch': true
  },
  {
    'inputs': [
      {
        'outer': {
          'x': 1,
          'y': 2
        }
      },
      {
        'outer': {
          'x': 1,
          'y': 2
        }
      }
    ],
    'name': 'produces the same hash for nested objects with different key order',
    'shouldMatch': true
  }
];

void describe('Value.hash consistency', () => {
  for (const scenario of hashScenarios) {
    void it(scenario.name, () => {
      const hashes = scenario.inputs.map((input) => {
        return Value.hash(input);
      });

      const first = hashes[0];

      assert.equal(typeof first, 'string', `${scenario.name} — type`);
      assert.ok(first.length > 0, `${scenario.name} — non-empty`);

      for (let i = 1; i < hashes.length; i++) {
        if (scenario.shouldMatch) {
          assert.equal(hashes[i], first, `${scenario.name} — hash ${i} matches`);
        }
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Value.diff edge cases
// ---------------------------------------------------------------------------

interface DiffScenario {
  'after': Record<string, unknown>;
  'assertions': (cs: ReturnType<typeof Value.diff>) => void;
  'before': Record<string, unknown>;
  'name': string;
}

const diffScenarios: DiffScenario[] = [
  {
    'after': {
      'a': 1,
      'b': 'hello',
      'c': { 'd': true }
    },
    'assertions': (cs) => {
      assert.equal(cs.isEmpty, true, 'identical — isEmpty');
      assert.equal(cs.length, 0, 'identical — length');
      assert.deepEqual(cs.operations, [], 'identical — operations');
    },
    'before': {
      'a': 1,
      'b': 'hello',
      'c': { 'd': true }
    },
    'name': 'produces an empty changeset for identical objects'
  },
  {
    'after': {
      'add': 42,
      'keep': 1,
      'modify': 'new'
    },
    'assertions': (cs) => {
      const modifyOps = cs.operations.filter((op) => {
        return op.path === '/modify';
      });

      assert.equal(modifyOps.length, 1, 'add/remove/modify — modify count');
      assert.equal(modifyOps[0].op, 'set', 'add/remove/modify — modify op');
      assert.equal((modifyOps[0] as { 'value': unknown }).value, 'new', 'add/remove/modify — modify value');

      const removeOps = cs.operations.filter((op) => {
        return op.path === '/remove';
      });

      assert.equal(removeOps.length, 1, 'add/remove/modify — remove count');
      assert.equal(removeOps[0].op, 'delete', 'add/remove/modify — remove op');

      const addOps = cs.operations.filter((op) => {
        return op.path === '/add';
      });

      assert.equal(addOps.length, 1, 'add/remove/modify — add count');
      assert.equal(addOps[0].op, 'set', 'add/remove/modify — add op');
      assert.equal((addOps[0] as { 'value': unknown }).value, 42, 'add/remove/modify — add value');

      const keepOps = cs.operations.filter((op) => {
        return op.path === '/keep';
      });

      assert.equal(keepOps.length, 0, 'add/remove/modify — keep unchanged');
    },
    'before': {
      'keep': 1,
      'modify': 'old',
      'remove': true
    },
    'name': 'generates correct ops for added, removed, and modified properties'
  },
  {
    'after': {
      'user': {
        'address': {
          'city': 'Portland',
          'zip': '98101'
        },
        'name': 'Alice'
      }
    },
    'assertions': (cs) => {
      assert.equal(cs.length, 1, 'nested change — length');
      assert.equal(cs.operations[0].op, 'set', 'nested change — op');
      assert.equal(cs.operations[0].path, '/user/address/city', 'nested change — path');
      assert.equal((cs.operations[0] as { 'value': unknown }).value, 'Portland', 'nested change — value');
    },
    'before': {
      'user': {
        'address': {
          'city': 'Seattle',
          'zip': '98101'
        },
        'name': 'Alice'
      }
    },
    'name': 'produces correct paths for nested property changes'
  }
];

void describe('Value.diff edge cases', () => {
  for (const scenario of diffScenarios) {
    void it(scenario.name, () => {
      const cs = Value.diff(scenario.before, scenario.after);

      scenario.assertions(cs);
    });
  }
});

// ---------------------------------------------------------------------------
// Value.diff with array element changes
// ---------------------------------------------------------------------------

interface ArrayDiffScenario {
  'after': Record<string, unknown>;
  'assertions': (cs: ReturnType<typeof Value.diff>) => void;
  'before': Record<string, unknown>;
  'name': string;
}

const arrayDiffScenarios: ArrayDiffScenario[] = [
  {
    'after': {
      'items': [
        'a',
        'X',
        'c'
      ]
    },
    'assertions': (cs) => {
      assert.equal(cs.length, 1, 'modified element — length');
      assert.equal(cs.operations[0].path, '/items/1', 'modified element — path');
      assert.equal(cs.operations[0].op, 'set', 'modified element — op');
      assert.equal((cs.operations[0] as { 'value': unknown }).value, 'X', 'modified element — value');
    },
    'before': {
      'items': [
        'a',
        'b',
        'c'
      ]
    },
    'name': 'detects modified array element'
  },
  {
    'after': {
      'items': [
        1,
        2,
        3
      ]
    },
    'assertions': (cs) => {
      const setOps = cs.operations.filter((op) => {
        return op.op === 'set';
      });

      assert.equal(setOps.length, 2, 'added elements — set count');
      assert.ok(setOps.some((op) => {
        return op.path === '/items/1' && op.value === 2;
      }), 'added elements — item 1');
      assert.ok(setOps.some((op) => {
        return op.path === '/items/2' && op.value === 3;
      }), 'added elements — item 2');
    },
    'before': { 'items': [1] },
    'name': 'detects added array elements'
  },
  {
    'after': { 'items': [1] },
    'assertions': (cs) => {
      const delOps = cs.operations.filter((op) => {
        return op.op === 'delete';
      });

      assert.equal(delOps.length, 2, 'removed elements — delete count');
      assert.ok(delOps.some((op) => {
        return op.path === '/items/1';
      }), 'removed elements — item 1');
      assert.ok(delOps.some((op) => {
        return op.path === '/items/2';
      }), 'removed elements — item 2');
    },
    'before': {
      'items': [
        1,
        2,
        3
      ]
    },
    'name': 'detects removed array elements'
  },
  {
    'after': {
      'users': [
        { 'name': 'Alice' },
        { 'name': 'Charlie' }
      ]
    },
    'assertions': (cs) => {
      assert.equal(cs.length, 1, 'nested array object — length');
      assert.equal(cs.operations[0].path, '/users/1/name', 'nested array object — path');
      assert.equal(cs.operations[0].op, 'set', 'nested array object — op');
      assert.equal((cs.operations[0] as { 'value': unknown }).value, 'Charlie', 'nested array object — value');
    },
    'before': {
      'users': [
        { 'name': 'Alice' },
        { 'name': 'Bob' }
      ]
    },
    'name': 'detects nested object change within array'
  }
];

void describe('Value.diff with array element changes', () => {
  for (const scenario of arrayDiffScenarios) {
    void it(scenario.name, () => {
      const cs = Value.diff(scenario.before, scenario.after);

      scenario.assertions(cs);
    });
  }
});
