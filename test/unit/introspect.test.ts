import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { Compose } from '../../src/modules/composition/Compose.js';

const TestSchema = {
  'properties': {
    'active': {
      'default': true,
      'type': 'boolean'
    },
    'age': { 'type': 'number' },
    'name': {
      'default': 'Alice',
      'type': 'string'
    },
    'nested': {
      'properties': {
        'count': {
          'default': 0,
          'type': 'number'
        },
        'label': { 'type': 'string' }
      },
      'type': 'object'
    }
  },
  'required': [
    'name',
    'age'
  ],
  'type': 'object'
} as const;

void describe('Compose.getDefaults()', () => {
  void it('returns defaults for top-level properties', () => {
    const defaults = Compose.getDefaults(TestSchema);

    assert.equal(defaults.name, 'Alice');
    assert.equal(defaults.active, true);
  });

  void it('omits properties without defaults', () => {
    const defaults = Compose.getDefaults(TestSchema);

    assert.equal('age' in defaults, false);
  });

  void it('recurses into nested object properties', () => {
    const defaults = Compose.getDefaults(TestSchema);
    const nested = defaults.nested as Record<string, unknown>;

    assert.equal(typeof nested, 'object');
    assert.equal(nested.count, 0);
    assert.equal('label' in nested, false);
  });

  void it('returns empty object for schema with no defaults', () => {
    assert.deepEqual(Compose.getDefaults({
      'properties': { 'x': { 'type': 'string' } },
      'type': 'object'
    }), {});
  });

  void it('returns empty object for schema with no properties', () => {
    assert.deepEqual(Compose.getDefaults({ 'type': 'object' }), {});
  });

  void it('deep-clones default values to prevent mutation', () => {
    const schema = {
      'properties': {
        'tags': {
          'default': [
            'a',
            'b'
          ],
          'type': 'array'
        }
      },
      'type': 'object'
    } as const;
    const d1 = Compose.getDefaults(schema);
    const d2 = Compose.getDefaults(schema);

    (d1.tags as string[]).push('c');
    assert.deepEqual(d2.tags, [
      'a',
      'b'
    ]);
  });
});
