import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Compose } from '../../src/modules/composition/Compose.js';

const TestSchema = {
  type: 'object',
  properties: {
    name:   { type: 'string', default: 'Alice' },
    age:    { type: 'number' },
    active: { type: 'boolean', default: true },
    nested: {
      type: 'object',
      properties: {
        count: { type: 'number', default: 0 },
        label: { type: 'string' },
      },
    },
  },
  required: ['name', 'age'],
} as const;

describe('Compose.getDefaults()', () => {
  it('returns defaults for top-level properties', () => {
    const defaults = Compose.getDefaults(TestSchema);
    assert.equal(defaults['name'], 'Alice');
    assert.equal(defaults['active'], true);
  });

  it('omits properties without defaults', () => {
    const defaults = Compose.getDefaults(TestSchema);
    assert.equal('age' in defaults, false);
  });

  it('recurses into nested object properties', () => {
    const defaults = Compose.getDefaults(TestSchema);
    const nested = defaults['nested'] as Record<string, unknown>;
    assert.ok(nested !== undefined);
    assert.equal(nested['count'], 0);
    assert.equal('label' in nested, false);
  });

  it('returns empty object for schema with no defaults', () => {
    assert.deepEqual(Compose.getDefaults({ type: 'object', properties: { x: { type: 'string' } } }), {});
  });

  it('returns empty object for schema with no properties', () => {
    assert.deepEqual(Compose.getDefaults({ type: 'object' }), {});
  });

  it('deep-clones default values to prevent mutation', () => {
    const schema = {
      type: 'object',
      properties: {
        tags: { type: 'array', default: ['a', 'b'] },
      },
    } as const;
    const d1 = Compose.getDefaults(schema);
    const d2 = Compose.getDefaults(schema);
    (d1['tags'] as string[]).push('c');
    assert.deepEqual(d2['tags'], ['a', 'b']);
  });
});
