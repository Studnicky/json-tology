/**
 * Hash utility tests — deterministic FNV-1a hashing for JSON-serializable values
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { Hash } from '../../src/index.js';

void describe('Hash.value()', { 'concurrency': true }, () => {
  const equalityScenarios: Array<{
    'a': unknown;
    'b': unknown;
    'equal': boolean;
    'name': string;
  }> = [
    // --- equal pairs ---
    {
      'a': {
        'age': 30,
        'name': 'Alice'
      },
      'b': {
        'age': 30,
        'name': 'Alice'
      },
      'equal': true,
      'name': 'happy: identical flat objects produce equal hashes'
    },
    {
      'a': {
        'a': 1,
        'b': 2
      },
      'b': {
        'a': 1,
        'b': 2
      },
      'equal': true,
      'name': 'happy: key-order insensitive objects produce equal hashes'
    },
    {
      'a': {
        'outer': {
          'x': 1,
          'y': 2
        },
        'z': 3
      },
      'b': {
        'outer': {
          'x': 1,
          'y': 2
        },
        'z': 3
      },
      'equal': true,
      'name': 'happy: nested objects produce equal hashes'
    },
    {
      'a': 42,
      'b': 42,
      'equal': true,
      'name': 'happy: equal numbers produce equal hashes'
    },
    {
      'a': 0,
      'b': 0,
      'equal': true,
      'name': 'happy: zero produces equal hashes'
    },
    {
      'a': -1,
      'b': -1,
      'equal': true,
      'name': 'happy: negative number produces equal hashes'
    },
    {
      'a': true,
      'b': true,
      'equal': true,
      'name': 'happy: true produces equal hashes'
    },
    {
      'a': false,
      'b': false,
      'equal': true,
      'name': 'happy: false produces equal hashes'
    },
    {
      'a': 'hello',
      'b': 'hello',
      'equal': true,
      'name': 'happy: equal strings produce equal hashes'
    },
    {
      'a': null,
      'b': null,
      'equal': true,
      'name': 'happy: null produces equal hashes'
    },
    {
      'a': [
        1,
        2,
        3
      ],
      'b': [
        1,
        2,
        3
      ],
      'equal': true,
      'name': 'happy: same-order arrays produce equal hashes'
    },
    {
      'a': {
        'a': {
          'b': {
            'c': {
              'd': [
                1,
                { 'e': 'f' }
              ]
            }
          }
        }
      },
      'b': {
        'a': {
          'b': {
            'c': {
              'd': [
                1,
                { 'e': 'f' }
              ]
            }
          }
        }
      },
      'equal': true,
      'name': 'happy: deeply nested structures produce equal hashes'
    },
    {
      'a': {},
      'b': {},
      'equal': true,
      'name': 'edge: empty object produces equal hashes'
    },
    {
      'a': [],
      'b': [],
      'equal': true,
      'name': 'edge: empty array produces equal hashes'
    },
    // --- unequal pairs ---
    {
      'a': { 'a': 1 },
      'b': { 'a': 2 },
      'equal': false,
      'name': 'unhappy: different property values produce different hashes'
    },
    {
      'a': 'hello',
      'b': 'world',
      'equal': false,
      'name': 'unhappy: different strings produce different hashes'
    },
    {
      'a': 1,
      'b': 2,
      'equal': false,
      'name': 'unhappy: different numbers produce different hashes'
    },
    {
      'a': true,
      'b': false,
      'equal': false,
      'name': 'unhappy: true vs false produce different hashes'
    },
    {
      'a': 42,
      'b': 43,
      'equal': false,
      'name': 'unhappy: adjacent numbers produce different hashes'
    },
    {
      'a': 'hello',
      'b': 'HELLO',
      'equal': false,
      'name': 'unhappy: case-sensitive strings produce different hashes'
    },
    {
      'a': null,
      'b': 0,
      'equal': false,
      'name': 'unhappy: null vs zero produce different hashes'
    },
    {
      'a': null,
      'b': '',
      'equal': false,
      'name': 'unhappy: null vs empty string produce different hashes'
    },
    {
      'a': 42,
      'b': '42',
      'equal': false,
      'name': 'unhappy: number vs string coercion distinction'
    },
    {
      'a': true,
      'b': 'true',
      'equal': false,
      'name': 'unhappy: boolean vs string coercion distinction'
    },
    {
      'a': null,
      'b': 'null',
      'equal': false,
      'name': 'unhappy: null vs literal string null distinction'
    },
    {
      'a': [
        1,
        2,
        3
      ],
      'b': [
        3,
        2,
        1
      ],
      'equal': false,
      'name': 'unhappy: array order matters'
    },
    {
      'a': {
        'a': {
          'b': {
            'c': {
              'd': [
                1,
                { 'e': 'f' }
              ]
            }
          }
        }
      },
      'b': {
        'a': {
          'b': {
            'c': {
              'd': [
                1,
                { 'e': 'g' }
              ]
            }
          }
        }
      },
      'equal': false,
      'name': 'unhappy: deep nested leaf difference produces different hashes'
    },
    {
      'a': { 'a': '1' },
      'b': { 'a': 1 },
      'equal': false,
      'name': 'edge: same keys different value types { a: "1" } vs { a: 1 }'
    },
    {
      'a': {},
      'b': [],
      'equal': false,
      'name': 'edge: empty object vs empty array produce different hashes'
    },
    {
      'a': null,
      'b': {},
      'equal': false,
      'name': 'edge: null vs empty object produce different hashes'
    }
  ];

  for (const {
    'a': a, 'b': b, 'equal': equal, 'name': name
  } of equalityScenarios) {
    void it(name, () => {
      if (equal) {
        assert.equal(Hash.value(a), Hash.value(b));
      } else {
        assert.notEqual(Hash.value(a), Hash.value(b));
      }
    });
  }

  const formatScenarios: Array<{
    'input': unknown;
    'name': string;
  }> = [
    {
      'input': { 'a': 1 },
      'name': 'happy: returns a hex string for a plain object'
    },
    {
      'input': null,
      'name': 'edge: returns a hex string for null'
    },
    {
      'input': {
        'a': {
          'b': [
            1,
            2,
            { 'c': true }
          ]
        }
      },
      'name': 'edge: returns a hex string for a deeply nested value'
    }
  ];

  for (const {
    'input': input, 'name': name
  } of formatScenarios) {
    void it(name, () => {
      const result = Hash.value(input);

      assert.equal(typeof result, 'string');
      assert.match(result, /^[0-9a-f]+$/u);
    });
  }

  void it('unhappy: throws on undefined (not JSON-serializable)', () => {
    assert.throws(() => {
      (Hash.value)();
    });
  });
});

// ---------------------------------------------------------------------------
// Hash bad / ugly paths — extended GBU coverage
// ---------------------------------------------------------------------------

function buildNestedHash(depth: number): Record<string, unknown> {
  let obj: Record<string, unknown> = { 'leaf': 'leaf-value' };

  for (let i = 0; i < depth; i++) {
    obj = { 'child': obj };
  }

  return obj;
}

function buildNestedHashWithLeaf(leafValue: string, depth: number): Record<string, unknown> {
  let obj: Record<string, unknown> = { 'leaf': leafValue };

  for (let i = 0; i < depth; i++) {
    obj = { 'child': obj };
  }

  return obj;
}

void describe('Hash bad/ugly paths', () => {
  // --- BigInt values ---
  void it('unhappy: BigInt value causes JSON.stringify to throw (not JSON-serializable)', () => {
    // BigInt is not JSON-serializable; JSON.stringify throws TypeError
    assert.throws(
      () => {
        Hash.value(BigInt(42));
      },
      (err: unknown) => {
        assert.ok(err instanceof TypeError, `expected TypeError, got ${String(err)}`);

        return true;
      }
    );
  });

  void it('unhappy: object containing BigInt property throws', () => {
    const obj = {
      'count': BigInt(1),
      'name': 'test'
    };

    assert.throws(
      () => {
        Hash.value(obj);
      },
      (err: unknown) => {
        assert.ok(err instanceof TypeError);

        return true;
      }
    );
  });

  // --- Symbol keys ---
  void it('edge: object with Symbol keys — Symbol-keyed props are silently dropped by JSON.stringify', () => {
    const sym = Symbol('key');
    const objWithSym: Record<string | symbol, unknown> = {
      [sym]: 'hidden',
      'visible': 'here'
    };

    // JSON.stringify ignores Symbol keys — no throw, but sym-keyed data is lost
    const hashWithSym = Hash.value(objWithSym);
    const hashWithout = Hash.value({ 'visible': 'here' });

    assert.equal(typeof hashWithSym, 'string');
    assert.match(hashWithSym, /^[0-9a-f]+$/u);
    // Hashes should be equal because Symbol keys are dropped
    assert.equal(hashWithSym, hashWithout);
  });

  void it('edge: two objects differing only in Symbol keys produce equal hashes', () => {
    const sym1 = Symbol('a');
    const sym2 = Symbol('b');
    const obj1: Record<string | symbol, unknown> = {
      'n': 1,
      [sym1]: 'x'
    };
    const obj2: Record<string | symbol, unknown> = {
      'n': 1,
      [sym2]: 'y'
    };

    assert.equal(Hash.value(obj1), Hash.value(obj2));
  });

  // --- Mixed prototype objects (Object.create(null)) ---
  void it('edge: null-prototype object hashes identically to a plain object with same keys', () => {
    const nullProto = Object.create(null) as Record<string, unknown>;

    nullProto.a = 1;
    nullProto.b = 'hello';

    const plainProto = {
      'a': 1,
      'b': 'hello'
    };

    // JSON.stringify handles both the same way (no prototype methods needed)
    assert.equal(Hash.value(nullProto), Hash.value(plainProto));
  });

  void it('edge: null-prototype object with no keys equals empty plain object', () => {
    const nullProto = Object.create(null) as Record<string, unknown>;

    assert.equal(Hash.value(nullProto), Hash.value({}));
  });

  // --- Circular references ---
  void it('unhappy: circular reference in an object throws (RangeError from keySortReplacer recursion)', () => {
    const obj: Record<string, unknown> = { 'a': 1 };

    // circular: obj.self points back to obj itself
    obj.self = obj;

    // BEHAVIOURAL NOTE: Hash.value() uses a custom keySortReplacer that recurses
    // into object values before JSON.stringify can detect the cycle via its own
    // guard, so the circular object reference exhausts the call stack and throws
    // a RangeError rather than the TypeError that JSON.stringify alone would throw.
    assert.throws(
      () => {
        Hash.value(obj);
      },
      (err: unknown) => {
        assert.ok(
          err instanceof RangeError || err instanceof TypeError,
          `expected RangeError or TypeError for circular ref, got ${String(err)}`
        );

        return true;
      }
    );
  });

  void it('unhappy: deeply nested circular array reference throws', () => {
    const arr: unknown[] = [
      1,
      2
    ];

    // circular: arr contains itself
    arr.push(arr);

    assert.throws(
      () => {
        Hash.value(arr);
      },
      (err: unknown) => {
        assert.ok(err instanceof TypeError);

        return true;
      }
    );
  });

  // --- Deeply nested data ---
  void it('edge: deeply nested legitimate data (50 levels) produces a hex string without throwing', () => {
    let nested: Record<string, unknown> = { 'leaf': 'value' };

    for (let i = 0; i < 50; i++) {
      nested = { 'child': nested };
    }

    const result = Hash.value(nested);

    assert.equal(typeof result, 'string');
    assert.match(result, /^[0-9a-f]+$/u);
  });

  void it('edge: deeply nested (50 levels) same structure produces equal hashes across calls', () => {
    assert.equal(Hash.value(buildNestedHash(50)), Hash.value(buildNestedHash(50)));
  });

  void it('edge: deeply nested (50 levels) that differs at leaf produces different hashes', () => {
    assert.notEqual(Hash.value(buildNestedHashWithLeaf('alpha', 50)), Hash.value(buildNestedHashWithLeaf('beta', 50)));
  });
});
