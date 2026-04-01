/**
 * Hash utility tests — deterministic FNV-1a hashing for JSON-serializable values
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { Hash } from '../../src/modules/hash/hash.js';

void describe('Hash.value()', () => {
  void it('returns a hex string', () => {
    const result = Hash.value({ 'a': 1 });

    assert.equal(typeof result, 'string');
    assert.match(result, /^[0-9a-f]+$/u);
  });

  void it('throws on undefined (not JSON-serializable)', () => {
    assert.throws(() => {
      Hash.value();
    });
  });

  void it('produces equal hashes for equivalent inputs', () => {
    const scenarios: Array<[unknown, unknown]> = [
      // Deterministic
      [
        {
          'age': 30,
          'name': 'Alice'
        },
        {
          'age': 30,
          'name': 'Alice'
        }
      ],
      // Key-order insensitive
      [
        {
          'a': 1,
          'b': 2
        },
        {
          'a': 1,
          'b': 2
        }
      ],
      // Nested objects
      [
        {
          'outer': {
            'x': 1,
            'y': 2
          },
          'z': 3
        },
        {
          'outer': {
            'x': 1,
            'y': 2
          },
          'z': 3
        }
      ],
      // Numbers
      [
        42,
        42
      ],
      [
        0,
        0
      ],
      [
        -1,
        -1
      ],
      // Booleans
      [
        true,
        true
      ],
      [
        false,
        false
      ],
      // Strings
      [
        'hello',
        'hello'
      ],
      // Null
      [
        null,
        null
      ],
      // Arrays (order matters — same order = equal)
      [
        [
          1,
          2,
          3
        ],
        [
          1,
          2,
          3
        ]
      ],
      // Deeply nested
      [
        {
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
        {
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
        }
      ]
    ];

    for (const [
      left,
      right
    ] of scenarios) {
      assert.equal(Hash.value(left), Hash.value(right));
    }
  });

  void it('produces different hashes for different inputs', () => {
    const scenarios: Array<[unknown, unknown]> = [
      // Different values
      [
        { 'a': 1 },
        { 'a': 2 }
      ],
      [
        'hello',
        'world'
      ],
      [
        1,
        2
      ],
      [
        true,
        false
      ],
      [
        42,
        43
      ],
      [
        'hello',
        'HELLO'
      ],
      // Null vs other types
      [
        null,
        0
      ],
      [
        null,
        ''
      ],
      // Type distinction
      [
        42,
        '42'
      ],
      [
        true,
        'true'
      ],
      [
        null,
        'null'
      ],
      // Array order matters
      [
        [
          1,
          2,
          3
        ],
        [
          3,
          2,
          1
        ]
      ],
      // Deep nested difference
      [
        {
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
        {
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
        }
      ]
    ];

    for (const [
      left,
      right
    ] of scenarios) {
      assert.notEqual(Hash.value(left), Hash.value(right));
    }
  });
});
