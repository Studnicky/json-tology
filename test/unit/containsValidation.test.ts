/**
 * Contains, minContains, and maxContains Validation
 *
 * Tests the contains keyword and its interaction with minContains
 * and maxContains for array-type schemas.
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { SchemaRegistry } from '../../src/modules/registry/schemaRegistry.js';

// ---------------------------------------------------------------------------
// Basic contains
// ---------------------------------------------------------------------------

void describe('contains validation', () => {
  void it('validates basic contains scenarios', () => {
    const registry = new SchemaRegistry();
    const schemaId = 'https://contains.test/Basic';

    registry.register({
      '$id': schemaId,
      'properties': {
        'values': {
          'contains': { 'type': 'number' },
          'type': 'array'
        }
      },
      'required': ['values'],
      'type': 'object'
    });

    const scenarios: Array<{ 'data': unknown;
      'name': string;
      'valid': boolean }> = [
      {
        'data': {
          'values': [
            'a',
            'b',
            42
          ]
        },
        'name': 'array with a matching number item',
        'valid': true
      },
      {
        'data': {
          'values': [
            1,
            2,
            3
          ]
        },
        'name': 'all items match',
        'valid': true
      },
      {
        'data': {
          'values': [
            'a',
            'b',
            'c'
          ]
        },
        'name': 'no items match',
        'valid': false
      },
      {
        'data': { 'values': [] },
        'name': 'empty array has no items to match',
        'valid': false
      }
    ];

    for (const {
      data, name, valid
    } of scenarios) {
      const errors = registry.validate(schemaId, data);

      assert.equal(errors.length === 0, valid, name);
    }
  });
});

// ---------------------------------------------------------------------------
// contains with true/false schemas
// ---------------------------------------------------------------------------

void describe('contains with boolean schemas', () => {
  void it('validates boolean contains scenarios', () => {
    const scenarios: Array<{ 'data': unknown;
      'name': string;
      'schema': Record<string, unknown>;
      'valid': boolean }> = [
      {
        'data': {
          'values': [
            1,
            'a',
            null,
            false
          ]
        },
        'name': 'contains true — any non-empty array passes',
        'schema': {
          '$id': 'https://contains.test/TrueSchema',
          'properties': {
            'values': {
              'contains': true,
              'type': 'array'
            }
          },
          'required': ['values'],
          'type': 'object'
        },
        'valid': true
      },
      {
        'data': {
          'values': [
            1,
            2,
            3
          ]
        },
        'name': 'contains false — no item can match',
        'schema': {
          '$id': 'https://contains.test/FalseSchema',
          'properties': {
            'values': {
              'contains': false,
              'type': 'array'
            }
          },
          'required': ['values'],
          'type': 'object'
        },
        'valid': false
      },
      {
        'data': {
          'values': [
            1,
            2,
            3
          ]
        },
        'name': 'contains false with minContains 0 passes',
        'schema': {
          '$id': 'https://contains.test/FalseMinZero',
          'properties': {
            'values': {
              'contains': false,
              'minContains': 0,
              'type': 'array'
            }
          },
          'required': ['values'],
          'type': 'object'
        },
        'valid': true
      }
    ];

    for (const {
      data, name, schema, valid
    } of scenarios) {
      const registry = new SchemaRegistry();

      registry.register(schema);
      assert.equal(registry.validate(schema.$id as string, data).length === 0, valid, name);
    }
  });
});

// ---------------------------------------------------------------------------
// minContains
// ---------------------------------------------------------------------------

void describe('minContains validation', () => {
  void it('validates minContains 0 scenarios', () => {
    const registry = new SchemaRegistry();
    const schemaId = 'https://contains.test/MinZero';

    registry.register({
      '$id': schemaId,
      'properties': {
        'values': {
          'contains': { 'type': 'number' },
          'minContains': 0,
          'type': 'array'
        }
      },
      'required': ['values'],
      'type': 'object'
    });

    const scenarios: Array<{ 'data': unknown;
      'name': string;
      'valid': boolean }> = [
      {
        'data': {
          'values': [
            'a',
            'b',
            'c'
          ]
        },
        'name': 'no matching items — valid because minContains is 0',
        'valid': true
      },
      {
        'data': { 'values': [] },
        'name': 'empty array — valid because minContains is 0',
        'valid': true
      }
    ];

    for (const {
      data, name, valid
    } of scenarios) {
      const errors = registry.validate(schemaId, data);

      assert.equal(errors.length === 0, valid, name);
    }
  });

  void it('validates minContains 2 scenarios', () => {
    const registry = new SchemaRegistry();
    const schemaId = 'https://contains.test/MinTwo';

    registry.register({
      '$id': schemaId,
      'properties': {
        'values': {
          'contains': { 'type': 'number' },
          'minContains': 2,
          'type': 'array'
        }
      },
      'required': ['values'],
      'type': 'object'
    });

    const scenarios: Array<{ 'data': unknown;
      'name': string;
      'valid': boolean }> = [
      {
        'data': {
          'values': [
            'a',
            1,
            'b',
            2
          ]
        },
        'name': 'two matching items',
        'valid': true
      },
      {
        'data': {
          'values': [
            1,
            2,
            3
          ]
        },
        'name': 'three matching items',
        'valid': true
      },
      {
        'data': {
          'values': [
            'a',
            1,
            'b'
          ]
        },
        'name': 'only one matching item — fails',
        'valid': false
      },
      {
        'data': {
          'values': [
            'a',
            'b'
          ]
        },
        'name': 'no matching items — fails',
        'valid': false
      }
    ];

    for (const {
      data, name, valid
    } of scenarios) {
      const errors = registry.validate(schemaId, data);

      assert.equal(errors.length === 0, valid, name);
    }
  });

  void it('validates minContains greater than array length always fails', () => {
    const registry = new SchemaRegistry();
    const schemaId = 'https://contains.test/MinExceedsLength';

    registry.register({
      '$id': schemaId,
      'properties': {
        'values': {
          'contains': { 'type': 'number' },
          'minContains': 5,
          'type': 'array'
        }
      },
      'required': ['values'],
      'type': 'object'
    });

    const scenarios: Array<{ 'data': unknown;
      'name': string;
      'valid': boolean }> = [
      {
        'data': {
          'values': [
            1,
            2,
            3
          ]
        },
        'name': 'array has only 3 items, cannot satisfy minContains=5',
        'valid': false
      },
      {
        'data': {
          'values': [
            1,
            2
          ]
        },
        'name': 'even with all matching, not enough items',
        'valid': false
      }
    ];

    for (const {
      data, name, valid
    } of scenarios) {
      const errors = registry.validate(schemaId, data);

      assert.equal(errors.length === 0, valid, name);
    }
  });
});

// ---------------------------------------------------------------------------
// maxContains
// ---------------------------------------------------------------------------

void describe('maxContains validation', () => {
  void it('validates maxContains 1 scenarios', () => {
    const registry = new SchemaRegistry();
    const schemaId = 'https://contains.test/MaxOne';

    registry.register({
      '$id': schemaId,
      'properties': {
        'values': {
          'contains': { 'type': 'number' },
          'maxContains': 1,
          'type': 'array'
        }
      },
      'required': ['values'],
      'type': 'object'
    });

    const scenarios: Array<{ 'data': unknown;
      'name': string;
      'valid': boolean }> = [
      {
        'data': {
          'values': [
            'a',
            1,
            'b'
          ]
        },
        'name': 'exactly one matching item',
        'valid': true
      },
      {
        'data': {
          'values': [
            1,
            2,
            'a'
          ]
        },
        'name': 'two matching items — exceeds maxContains',
        'valid': false
      }
    ];

    for (const {
      data, name, valid
    } of scenarios) {
      const errors = registry.validate(schemaId, data);

      assert.equal(errors.length === 0, valid, name);
    }
  });

  void it('validates maxContains 0 scenarios', () => {
    const registry = new SchemaRegistry();
    const schemaId = 'https://contains.test/MaxZero';

    registry.register({
      '$id': schemaId,
      'properties': {
        'values': {
          'contains': { 'type': 'number' },
          'maxContains': 0,
          'minContains': 0,
          'type': 'array'
        }
      },
      'required': ['values'],
      'type': 'object'
    });

    const scenarios: Array<{ 'data': unknown;
      'name': string;
      'valid': boolean }> = [
      {
        'data': {
          'values': [
            'a',
            'b',
            'c'
          ]
        },
        'name': 'no matching items — valid',
        'valid': true
      },
      {
        'data': {
          'values': [
            'a',
            1,
            'b'
          ]
        },
        'name': 'one matching item — exceeds maxContains=0',
        'valid': false
      }
    ];

    for (const {
      data, name, valid
    } of scenarios) {
      const errors = registry.validate(schemaId, data);

      assert.equal(errors.length === 0, valid, name);
    }
  });
});

// ---------------------------------------------------------------------------
// minContains + maxContains range
// ---------------------------------------------------------------------------

void describe('minContains and maxContains range', () => {
  void it('validates matching count within min and max bounds', () => {
    const registry = new SchemaRegistry();
    const schemaId = 'https://contains.test/Range';

    registry.register({
      '$id': schemaId,
      'properties': {
        'values': {
          'contains': { 'type': 'number' },
          'maxContains': 4,
          'minContains': 2,
          'type': 'array'
        }
      },
      'required': ['values'],
      'type': 'object'
    });

    const scenarios: Array<{ 'data': unknown;
      'name': string;
      'valid': boolean }> = [
      {
        'data': {
          'values': [
            'a',
            1,
            'b',
            2
          ]
        },
        'name': 'exactly 2 matching items (lower bound)',
        'valid': true
      },
      {
        'data': {
          'values': [
            1,
            2,
            3,
            'a'
          ]
        },
        'name': 'exactly 3 matching items (mid range)',
        'valid': true
      },
      {
        'data': {
          'values': [
            1,
            2,
            3,
            4
          ]
        },
        'name': 'exactly 4 matching items (upper bound)',
        'valid': true
      },
      {
        'data': {
          'values': [
            'a',
            1,
            'b',
            'c'
          ]
        },
        'name': 'only 1 matching item — below minContains',
        'valid': false
      },
      {
        'data': {
          'values': [
            1,
            2,
            3,
            4,
            5
          ]
        },
        'name': '5 matching items — exceeds maxContains',
        'valid': false
      }
    ];

    for (const {
      data, name, valid
    } of scenarios) {
      const errors = registry.validate(schemaId, data);

      assert.equal(errors.length === 0, valid, name);
    }
  });

  void it('validates maxContains less than minContains always fails', () => {
    const registry = new SchemaRegistry();
    const schemaId = 'https://contains.test/Impossible';

    registry.register({
      '$id': schemaId,
      'properties': {
        'values': {
          'contains': { 'type': 'number' },
          'maxContains': 1,
          'minContains': 3,
          'type': 'array'
        }
      },
      'required': ['values'],
      'type': 'object'
    });

    const scenarios: Array<{ 'data': unknown;
      'name': string;
      'valid': boolean }> = [
      {
        'data': {
          'values': [
            1,
            2,
            3
          ]
        },
        'name': 'cannot satisfy min=3 and max=1 with 3 numbers',
        'valid': false
      },
      {
        'data': { 'values': [1] },
        'name': 'cannot satisfy min=3 and max=1 with 1 number',
        'valid': false
      },
      {
        'data': {
          'values': [
            'a',
            'b'
          ]
        },
        'name': 'cannot satisfy min=3 and max=1 with no numbers',
        'valid': false
      }
    ];

    for (const {
      data, name, valid
    } of scenarios) {
      const errors = registry.validate(schemaId, data);

      assert.equal(errors.length === 0, valid, name);
    }
  });
});
