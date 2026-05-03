import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { CoercionError } from '../../src/errors/CoercionError.js';
import { SchemaRegistry } from '../../src/modules/registry/SchemaRegistry.js';

const SingleAliasSchema = {
  '$id': 'https://example.com/SingleAlias',
  'properties': {
    'fooBar': {
      'jt:alias': 'foo_bar',
      'type': 'string'
    }
  },
  'type': 'object'
} as const;

const MultiAliasSchema = {
  '$id': 'https://example.com/MultiAlias',
  'properties': {
    'fooBar': {
      'jt:alias': [
        'foo_bar',
        'fooBarLegacy'
      ],
      'type': 'string'
    }
  },
  'type': 'object'
} as const;

const RequiredAliasSchema = {
  '$id': 'https://example.com/RequiredAlias',
  'properties': {
    'fooBar': {
      'jt:alias': 'foo_bar',
      'type': 'string'
    }
  },
  'required': ['fooBar'],
  'type': 'object'
} as const;

const NestedAliasSchema = {
  '$defs': {
    'Inner': {
      '$id': 'https://example.com/Inner',
      'properties': {
        'myProp': {
          'jt:alias': 'my_prop',
          'type': 'string'
        }
      },
      'type': 'object'
    }
  },
  '$id': 'https://example.com/Nested',
  'properties': { 'inner': { '$ref': '#/$defs/Inner' } },
  'type': 'object'
} as const;

const ArrayItemAliasSchema = {
  '$defs': {
    'Item': {
      '$id': 'https://example.com/Item',
      'properties': {
        'label': {
          'jt:alias': 'lbl',
          'type': 'string'
        }
      },
      'type': 'object'
    }
  },
  '$id': 'https://example.com/ArrayItems',
  'items': { '$ref': '#/$defs/Item' },
  'type': 'array'
} as const;

void describe('jt:alias coercion', () => {
  void describe('single alias', () => {
    void it('maps alias input to canonical key', () => {
      const registry = new SchemaRegistry();

      registry.register(SingleAliasSchema);
      const result = registry.coerce(SingleAliasSchema.$id, { 'foo_bar': 'hello' });

      assert.deepStrictEqual(result, { 'fooBar': 'hello' });
    });

    void it('canonical key still works when no alias is used', () => {
      const registry = new SchemaRegistry();

      registry.register(SingleAliasSchema);
      const result = registry.coerce(SingleAliasSchema.$id, { 'fooBar': 'hello' });

      assert.deepStrictEqual(result, { 'fooBar': 'hello' });
    });

    void it('canonical key wins when both canonical and alias are present', () => {
      const registry = new SchemaRegistry();

      registry.register(SingleAliasSchema);
      const result = registry.coerce(SingleAliasSchema.$id, {
        'foo_bar': 'alias-value',
        'fooBar': 'canonical-value'
      });

      assert.deepStrictEqual(result, { 'fooBar': 'canonical-value' });
    });

    void it('original input is not mutated', () => {
      const registry = new SchemaRegistry();

      registry.register(SingleAliasSchema);
      const input = { 'foo_bar': 'hello' };

      registry.coerce(SingleAliasSchema.$id, input);
      assert.deepStrictEqual(input, { 'foo_bar': 'hello' });
    });
  });

  void describe('multi-alias', () => {
    void it('first alias in list resolves when canonical key absent', () => {
      const registry = new SchemaRegistry();

      registry.register(MultiAliasSchema);
      const result = registry.coerce(MultiAliasSchema.$id, { 'foo_bar': 'value1' });

      assert.deepStrictEqual(result, { 'fooBar': 'value1' });
    });

    void it('second alias in list resolves when first alias and canonical key absent', () => {
      const registry = new SchemaRegistry();

      registry.register(MultiAliasSchema);
      const result = registry.coerce(MultiAliasSchema.$id, { 'fooBarLegacy': 'legacy' });

      assert.deepStrictEqual(result, { 'fooBar': 'legacy' });
    });

    void it('canonical key takes priority over all aliases', () => {
      const registry = new SchemaRegistry();

      registry.register(MultiAliasSchema);
      const result = registry.coerce(MultiAliasSchema.$id, {
        'foo_bar': 'alias1',
        'fooBar': 'canonical',
        'fooBarLegacy': 'alias2'
      });

      assert.deepStrictEqual(result, { 'fooBar': 'canonical' });
    });
  });

  void describe('required properties with alias', () => {
    void it('alias satisfies required constraint', () => {
      const registry = new SchemaRegistry();

      registry.register(RequiredAliasSchema);
      assert.doesNotThrow(() => {
        registry.coerce(RequiredAliasSchema.$id, { 'foo_bar': 'value' });
      });
    });

    void it('missing both canonical and alias fails required validation', () => {
      const registry = new SchemaRegistry();

      registry.register(RequiredAliasSchema);
      assert.throws(() => {
        registry.coerce(RequiredAliasSchema.$id, {});
      });
    });
  });

  void describe('nested object alias', () => {
    void it('alias on nested object property resolves to canonical key', () => {
      const registry = new SchemaRegistry();

      registry.register(NestedAliasSchema);
      const result = registry.coerce(NestedAliasSchema.$id, { 'inner': { 'my_prop': 'nested-value' } });

      assert.deepStrictEqual(result, { 'inner': { 'myProp': 'nested-value' } });
    });
  });

  void describe('array item alias', () => {
    void it('alias on items schema property resolves for each element', () => {
      const registry = new SchemaRegistry();

      registry.register(ArrayItemAliasSchema);
      const result = registry.coerce(ArrayItemAliasSchema.$id, [
        { 'lbl': 'first' },
        { 'lbl': 'second' }
      ]);

      assert.deepStrictEqual(result, [
        { 'label': 'first' },
        { 'label': 'second' }
      ]);
    });
  });

  void describe('error messages use canonical pointer', () => {
    void it('validation errors reference canonical key path, not alias path', () => {
      const WrongTypeSchema = {
        '$id': 'https://example.com/WrongTypeAlias',
        'properties': {
          'count': {
            'jt:alias': 'cnt',
            'type': 'integer'
          }
        },
        'type': 'object'
      } as const;

      const registry = new SchemaRegistry();

      registry.register(WrongTypeSchema);

      let coercionPaths: string[] = [];

      try {
        registry.coerce(WrongTypeSchema.$id, { 'cnt': 'not-a-number' });
      } catch (error: unknown) {
        if (error instanceof CoercionError) {
          coercionPaths = error.errors.items.map((item) => {
            return item.path;
          });
        }
      }

      assert.ok(coercionPaths.length > 0, 'expected validation errors from coerce');
      assert.ok(
        coercionPaths.some((path) => {
          return path.includes('/count');
        }),
        `expected error path to reference /count, got: ${coercionPaths.join(', ')}`
      );
    });
  });
});
