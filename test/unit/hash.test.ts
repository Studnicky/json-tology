/**
 * Hash utility tests — deterministic FNV-1a hashing for JSON-serializable values
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { Hash } from '../../src/modules/hash/hash.js';

void describe('Hash.value()', () => {
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
      (Hash.value as (input?: unknown) => string)();
    });
  });
});
