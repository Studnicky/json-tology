// Merged from: aliasCoercion.test.ts, refAndNesting.test.ts, strictField.test.ts, frozenOutput.test.ts, enableDefaults.test.ts, enableStrictGraph.test.ts
// Phase-1 mechanical consolidation per .audits/test-consolidation-2026-05.md

import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';
import {
  InstantiationError, JsonTology, SchemaError
} from '../../src/index.js';
import { Logger } from '../utils/Logger.js';

// ===========================================================================
// Source: aliasCoercion.test.ts
// ===========================================================================
{
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

  void describe('jt:alias coercion', { 'concurrency': true }, () => {
    void describe('single alias', { 'concurrency': true }, () => {
      const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });

      registry.register(SingleAliasSchema);

      void it('maps alias input to canonical key', () => {
        const result = registry.instantiate(SingleAliasSchema.$id, { 'foo_bar': 'hello' });

        assert.deepStrictEqual(result, { 'fooBar': 'hello' });
      });

      void it('canonical key still works when no alias is used', () => {
        const result = registry.instantiate(SingleAliasSchema.$id, { 'fooBar': 'hello' });

        assert.deepStrictEqual(result, { 'fooBar': 'hello' });
      });

      void it('canonical key wins when both canonical and alias are present', () => {
        const result = registry.instantiate(SingleAliasSchema.$id, {
          'foo_bar': 'alias-value',
          'fooBar': 'canonical-value'
        });

        assert.deepStrictEqual(result, { 'fooBar': 'canonical-value' });
      });

      void it('original input is not mutated', () => {
        const input = { 'foo_bar': 'hello' };

        registry.instantiate(SingleAliasSchema.$id, input);
        assert.deepStrictEqual(input, { 'foo_bar': 'hello' });
      });
    });

    void describe('multi-alias', { 'concurrency': true }, () => {
      const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });

      registry.register(MultiAliasSchema);

      void it('first alias in list resolves when canonical key absent', () => {
        const result = registry.instantiate(MultiAliasSchema.$id, { 'foo_bar': 'value1' });

        assert.deepStrictEqual(result, { 'fooBar': 'value1' });
      });

      void it('second alias in list resolves when first alias and canonical key absent', () => {
        const result = registry.instantiate(MultiAliasSchema.$id, { 'fooBarLegacy': 'legacy' });

        assert.deepStrictEqual(result, { 'fooBar': 'legacy' });
      });

      void it('canonical key takes priority over all aliases', () => {
        const result = registry.instantiate(MultiAliasSchema.$id, {
          'foo_bar': 'alias1',
          'fooBar': 'canonical',
          'fooBarLegacy': 'alias2'
        });

        assert.deepStrictEqual(result, { 'fooBar': 'canonical' });
      });
    });

    void describe('required properties with alias', { 'concurrency': true }, () => {
      const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });

      registry.register(RequiredAliasSchema);

      void it('alias satisfies required constraint', () => {
        assert.doesNotThrow(() => {
          registry.instantiate(RequiredAliasSchema.$id, { 'foo_bar': 'value' });
        });
      });

      void it('missing both canonical and alias fails required validation', () => {
        assert.throws(() => {
          registry.instantiate(RequiredAliasSchema.$id, {});
        });
      });
    });

    void describe('nested object alias', { 'concurrency': true }, () => {
      const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });

      registry.register(NestedAliasSchema);

      void it('alias on nested object property resolves to canonical key', () => {
        const result = registry.instantiate(NestedAliasSchema.$id, { 'inner': { 'my_prop': 'nested-value' } });

        assert.deepStrictEqual(result, { 'inner': { 'myProp': 'nested-value' } });
      });
    });

    void describe('array item alias', { 'concurrency': true }, () => {
      const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });

      registry.register(ArrayItemAliasSchema);

      void it('alias on items schema property resolves for each element', () => {
        const result = registry.instantiate(ArrayItemAliasSchema.$id, [
          { 'lbl': 'first' },
          { 'lbl': 'second' }
        ]);

        assert.deepStrictEqual(result, [
          { 'label': 'first' },
          { 'label': 'second' }
        ]);
      });
    });

    void describe('error messages use canonical pointer', { 'concurrency': true }, () => {
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

        const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });

        registry.register(WrongTypeSchema);

        let coercionPaths: string[] = [];

        try {
          registry.instantiate(WrongTypeSchema.$id, { 'cnt': 'not-a-number' });
        } catch (error: unknown) {
          if (error instanceof InstantiationError) {
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
}

// ===========================================================================
// Source: refAndNesting.test.ts
// ===========================================================================
{
  const logger = new Logger({ 'silent': true });

  interface ValidationScenario { 'data': unknown;
    'name': string;
    'valid': boolean }

  function assertValidationScenarios(
    registry: JsonTology,
    schemaId: string,
    scenarios: ValidationScenario[]
  ): void {
    for (const {
      data, name, valid
    } of scenarios) {
      const errors = registry.validate(schemaId, data);

      if (valid) {
        assert.strictEqual(errors.length, 0, `expected valid: ${name}`);
      } else {
        assert.ok(errors.length > 0, `expected invalid: ${name}`);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Self-Referencing Schemas
  // ---------------------------------------------------------------------------

  void describe('Self-referencing schemas', { 'concurrency': true }, () => {
    void it('validates a tree structure with recursive $ref', () => {
      const registry = JsonTology.create({
        'baseIRI': 'urn:test:',
        'logger': logger
      });

      registry.register({
        '$id': 'https://ref.test/Tree',
        'properties': {
          'children': {
            'items': { '$ref': 'https://ref.test/Tree' },
            'type': 'array'
          },
          'value': { 'type': 'string' }
        },
        'required': ['value'],
        'type': 'object'
      });

      const scenarios: ValidationScenario[] = [
        {
          'data': {
            'children': [
              {
                'children': [
                  { 'value': 'grandchild-1' },
                  { 'value': 'grandchild-2' }
                ],
                'value': 'child-1'
              },
              { 'value': 'child-2' }
            ],
            'value': 'root'
          },
          'name': 'valid 3-level deep tree',
          'valid': true
        },
        {
          'data': {
            'children': [{
              'children': [{ 'notValue': 'missing value key' }],
              'value': 'child-1'
            }],
            'value': 'root'
          },
          'name': 'nested child missing required value',
          'valid': false
        },
        {
          'data': null,
          'name': 'edge: null at root level',
          'valid': false
        },
        {
          'data': {
            'children': [null],
            'value': 'root'
          },
          'name': 'edge: null inside children array at ref position',
          'valid': false
        },
        {
          'data': {
            'children': [],
            'value': 'root'
          },
          'name': 'edge: empty children array is valid',
          'valid': true
        },
        {
          'data': {
            'children': [{}],
            'value': 'root'
          },
          'name': 'unhappy: empty object at ref position — missing required value',
          'valid': false
        }
      ];

      assertValidationScenarios(registry, 'https://ref.test/Tree', scenarios);
    });

    void it('validates a linked list with recursive optional $ref', () => {
      const registry = JsonTology.create({
        'baseIRI': 'urn:test:',
        'logger': logger
      });

      registry.register({
        '$id': 'https://ref.test/ListNode',
        'properties': {
          'next': { '$ref': 'https://ref.test/ListNode' },
          'value': { 'type': 'number' }
        },
        'required': ['value'],
        'type': 'object'
      });

      const scenarios: ValidationScenario[] = [
        {
          'data': {
            'next': {
              'next': { 'value': 3 },
              'value': 2
            },
            'value': 1
          },
          'name': 'valid linked list 1 -> 2 -> 3',
          'valid': true
        },
        {
          'data': {
            'next': {
              'next': { 'value': 3 },
              'value': 'not-a-number'
            },
            'value': 1
          },
          'name': 'middle node has wrong type for value',
          'valid': false
        }
      ];

      assertValidationScenarios(registry, 'https://ref.test/ListNode', scenarios);
    });

    void it('validates self-referencing via $defs', () => {
      const registry = JsonTology.create({
        'baseIRI': 'urn:test:',
        'logger': logger
      });

      registry.register({
        '$defs': {
          'Node': {
            'properties': {
              'children': {
                'items': { '$ref': '#/$defs/Node' },
                'type': 'array'
              },
              'label': { 'type': 'string' }
            },
            'required': ['label'],
            'type': 'object'
          }
        },
        '$id': 'https://ref.test/SelfDefs',
        'properties': { 'root': { '$ref': '#/$defs/Node' } },
        'type': 'object'
      });

      const scenarios: ValidationScenario[] = [
        {
          'data': {
            'root': {
              'children': [{
                'children': [],
                'label': 'leaf'
              }],
              'label': 'top'
            }
          },
          'name': 'valid nested node via $defs',
          'valid': true
        },
        {
          'data': {
            'root': {
              'children': [{ 'children': [] }],
              'label': 'top'
            }
          },
          'name': 'nested node missing required label',
          'valid': false
        }
      ];

      assertValidationScenarios(registry, 'https://ref.test/SelfDefs', scenarios);
    });
  });

  // ---------------------------------------------------------------------------
  // Cross-Schema References
  // ---------------------------------------------------------------------------

  void describe('Cross-schema references', { 'concurrency': true }, () => {
    void it('validates mutual recursion between two schemas', () => {
      const registry = JsonTology.create({
        'baseIRI': 'urn:test:',
        'logger': logger
      });

      registry.register([
        {
          '$id': 'https://ref.test/Person',
          'properties': {
            'bestFriend': { '$ref': 'https://ref.test/Pet' },
            'name': { 'type': 'string' }
          },
          'required': ['name'],
          'type': 'object'
        },
        {
          '$id': 'https://ref.test/Pet',
          'properties': {
            'breed': { 'type': 'string' },
            'owner': { '$ref': 'https://ref.test/Person' }
          },
          'required': ['breed'],
          'type': 'object'
        }
      ]);

      const scenarios: ValidationScenario[] = [
        {
          'data': {
            'bestFriend': {
              'breed': 'Labrador',
              'owner': { 'name': 'Alice' }
            },
            'name': 'Alice'
          },
          'name': 'valid mutual reference',
          'valid': true
        },
        {
          'data': {
            'bestFriend': { 'owner': { 'name': 'Bob' } },
            'name': 'Bob'
          },
          'name': 'referenced Pet missing required breed',
          'valid': false
        }
      ];

      assertValidationScenarios(registry, 'https://ref.test/Person', scenarios);
    });

    void it('validates a three-level reference chain A -> B -> C', () => {
      const registry = JsonTology.create({
        'baseIRI': 'urn:test:',
        'logger': logger
      });

      registry.register([
        {
          '$id': 'https://ref.test/ChainC',
          'properties': { 'code': { 'type': 'string' } },
          'required': ['code'],
          'type': 'object'
        },
        {
          '$id': 'https://ref.test/ChainB',
          'properties': {
            'detail': { '$ref': 'https://ref.test/ChainC' },
            'level': { 'type': 'number' }
          },
          'required': ['level'],
          'type': 'object'
        },
        {
          '$id': 'https://ref.test/ChainA',
          'properties': {
            'child': { '$ref': 'https://ref.test/ChainB' },
            'name': { 'type': 'string' }
          },
          'required': ['name'],
          'type': 'object'
        }
      ]);

      const scenarios: ValidationScenario[] = [
        {
          'data': {
            'child': {
              'detail': { 'code': 'X-99' },
              'level': 2
            },
            'name': 'top'
          },
          'name': 'valid chain A -> B -> C',
          'valid': true
        },
        {
          'data': {
            'child': {
              'detail': {},
              'level': 2
            },
            'name': 'top'
          },
          'name': 'deepest schema missing required code',
          'valid': false
        },
        {
          'data': {
            'child': {
              'detail': null,
              'level': 2
            },
            'name': 'top'
          },
          'name': 'edge: null at deeply nested ref position (detail)',
          'valid': false
        },
        {
          'data': {
            'child': null,
            'name': 'top'
          },
          'name': 'edge: null at intermediate ref position (child)',
          'valid': false
        },
        {
          'data': { 'name': 'top' },
          'name': 'edge: missing optional child ref — valid (not required)',
          'valid': true
        }
      ];

      assertValidationScenarios(registry, 'https://ref.test/ChainA', scenarios);
    });

    void it('throws GraphError REF_UNRESOLVED on first use when a cross-schema $ref points to an unregistered IRI', () => {
      const registry = JsonTology.create({
        'baseIRI': 'urn:test:',
        'logger': logger
      });

      // Registration must NOT throw — schemas can register in any order and
      // forward refs across schemas are common during bootstrap.
      registry.register({
        '$id': 'https://ref.test/Dangling',
        'properties': { 'link': { '$ref': 'https://ref.test/DoesNotExist' } },
        'type': 'object'
      });

      // The lazy walker fires on first use (validate / instantiate / materialize /
      // createDefault) and throws REF_UNRESOLVED — runtime parity with the
      // compile-time cross-schema $ref check in InferType.
      assert.throws(
        () => {
          return registry.validate('https://ref.test/Dangling', { 'link': {} });
        },
        (err: unknown) => {
          return err instanceof Error
            && (err as { 'code'?: unknown }).code === 'REF_UNRESOLVED';
        }
      );
    });
  });

  // ---------------------------------------------------------------------------
  // $anchor and $defs
  // ---------------------------------------------------------------------------

  void describe('$anchor and $defs resolution', { 'concurrency': true }, () => {
    void it('resolves $ref to $anchor within the same schema', () => {
      const registry = JsonTology.create({
        'baseIRI': 'urn:test:',
        'logger': logger
      });

      registry.register({
        '$defs': {
          'EmailType': {
            '$anchor': 'emailDef',
            'format': 'email',
            'type': 'string'
          }
        },
        '$id': 'https://ref.test/WithAnchor',
        'properties': { 'contactEmail': { '$ref': '#emailDef' } },
        'type': 'object'
      });

      const scenarios: ValidationScenario[] = [
        {
          'data': { 'contactEmail': 'user@example.com' },
          'name': 'valid email via $anchor ref',
          'valid': true
        },
        {
          'data': { 'contactEmail': 12_345 },
          'name': 'invalid type via $anchor ref',
          'valid': false
        }
      ];

      assertValidationScenarios(registry, 'https://ref.test/WithAnchor', scenarios);
    });

    void it('resolves $ref to $defs via JSON pointer', () => {
      const registry = JsonTology.create({
        'baseIRI': 'urn:test:',
        'logger': logger
      });

      registry.register({
        '$defs': {
          'Address': {
            'properties': {
              'city': { 'type': 'string' },
              'zip': { 'type': 'string' }
            },
            'required': ['city'],
            'type': 'object'
          }
        },
        '$id': 'https://ref.test/WithPointer',
        'properties': {
          'home': { '$ref': '#/$defs/Address' },
          'work': { '$ref': '#/$defs/Address' }
        },
        'type': 'object'
      });

      const scenarios: ValidationScenario[] = [
        {
          'data': {
            'home': {
              'city': 'Springfield',
              'zip': '62704'
            },
            'work': { 'city': 'Shelbyville' }
          },
          'name': 'both properties satisfy Address definition',
          'valid': true
        },
        {
          'data': {
            'home': { 'zip': '62704' },
            'work': { 'city': 'Shelbyville' }
          },
          'name': 'home missing required city',
          'valid': false
        }
      ];

      assertValidationScenarios(registry, 'https://ref.test/WithPointer', scenarios);
    });
  });

  // ---------------------------------------------------------------------------
  // Deep Nesting
  // ---------------------------------------------------------------------------

  void describe('Deep nesting', { 'concurrency': true }, () => {
    void it('validates 10+ levels of nested objects via $ref chain', () => {
      const registry = JsonTology.create({
        'baseIRI': 'urn:test:',
        'logger': logger
      });

      const depth = 12;
      const baseUrl = 'https://ref.test/deep';

      // Build 12 separate schemas, each referencing the next via $ref
      // Level 0 is the leaf, levels 1..11 wrap it
      const schemas: Array<Record<string, unknown>> = [];

      schemas.push({
        '$id': `${baseUrl}/Level0`,
        'properties': { 'leaf': { 'type': 'string' } },
        'required': ['leaf'],
        'type': 'object'
      });

      for (let level = 1; level < depth; level++) {
        const key = `level${level}`;

        schemas.push({
          '$id': `${baseUrl}/Level${String(level)}`,
          'properties': { [key]: { '$ref': `${baseUrl}/Level${String(level - 1)}` } },
          'required': [key],
          'type': 'object'
        });
      }

      registry.register(schemas);

      const topId = `${baseUrl}/Level${String(depth - 1)}`;

      const buildDeepData = (leafValue: unknown): Record<string, unknown> => {
        let data: Record<string, unknown> = { 'leaf': leafValue };

        for (let level = 1; level < depth; level++) {
          data = { [`level${level}`]: data };
        }

        return data;
      };

      const scenarios: ValidationScenario[] = [
        {
          'data': buildDeepData('found'),
          'name': 'valid leaf at depth 12',
          'valid': true
        },
        {
          'data': buildDeepData(42),
          'name': 'wrong type at deepest leaf',
          'valid': false
        }
      ];

      assertValidationScenarios(registry, topId, scenarios);
    });

    void it('applies defaults at multiple nesting levels', () => {
      const registry = JsonTology.create({
        'baseIRI': 'urn:test:',
        'logger': logger
      });

      registry.register({
        '$id': 'https://ref.test/DeepDefaults',
        'properties': {
          'outer': {
            '$id': 'https://ref.test/DeepDefaults/Outer',
            'default': {},
            'properties': {
              'inner': {
                '$id': 'https://ref.test/DeepDefaults/Inner',
                'default': {},
                'properties': {
                  'value': {
                    'default': 'fallback',
                    'type': 'string'
                  }
                },
                'type': 'object'
              }
            },
            'type': 'object'
          }
        },
        'type': 'object'
      });

      // coerce should apply defaults at each level
      const result = registry.instantiate(
        'https://ref.test/DeepDefaults',
        { 'outer': { 'inner': {} } }
      ) as Record<string, unknown>;

      const outer = result.outer as Record<string, unknown>;
      const inner = outer.inner as Record<string, unknown>;

      assert.strictEqual(inner.value, 'fallback');
    });
  });

  // ---------------------------------------------------------------------------
  // $ref with Sibling Keywords (2020-12 Merge Semantics)
  // ---------------------------------------------------------------------------

  void describe('$ref with sibling keywords', { 'concurrency': true }, () => {
    void it('merges $ref with sibling properties in 2020-12 dialect', () => {
      const registry = JsonTology.create({
        'baseIRI': 'urn:test:',
        'logger': logger
      });

      registry.register([
        {
          '$id': 'https://ref.test/Base',
          'properties': { 'name': { 'type': 'string' } },
          'required': ['name'],
          'type': 'object'
        },
        {
          '$id': 'https://ref.test/Extended',
          '$ref': 'https://ref.test/Base',
          'properties': { 'age': { 'type': 'number' } },
          'required': ['age'],
          'type': 'object'
        }
      ]);

      const scenarios: ValidationScenario[] = [
        {
          'data': {
            'age': 30,
            'name': 'Alice'
          },
          'name': 'satisfies both $ref target and local requirements',
          'valid': true
        },
        {
          'data': { 'name': 'Alice' },
          'name': 'missing age from sibling keywords',
          'valid': false
        },
        {
          'data': { 'age': 30 },
          'name': 'missing name from $ref target',
          'valid': false
        }
      ];

      assertValidationScenarios(registry, 'https://ref.test/Extended', scenarios);
    });
  });
}

// ===========================================================================
// Source: strictField.test.ts
// ===========================================================================
{
  const StrictFieldSchema = {
    '$id': 'https://ex.io/StrictField',
    'properties': {
      'age': {
        'jt:strict': true,
        'type': 'integer'
      },
      'name': { 'type': 'string' }
    },
    'required': [
      'age',
      'name'
    ],
    'type': 'object'
  } as const;

  const GlobalStrictConfigSchema = {
    '$id': 'https://ex.io/GlobalStrictConfig',
    'jt:config': { 'strict': true },
    'properties': {
      'count': { 'type': 'integer' },
      'label': {
        'jt:strict': false,
        'type': 'string'
      }
    },
    'required': [
      'count',
      'label'
    ],
    'type': 'object'
  } as const;

  void describe('jt:strict per-field', { 'concurrency': true }, () => {
    void it('accepts correct JS type for strict field', () => {
      const registry = JsonTology.create({
        'baseIRI': 'urn:test:',
        'enableTypeCast': true
      });

      registry.register(StrictFieldSchema);
      const result = registry.instantiate(StrictFieldSchema.$id, {
        'age': 30,
        'name': 'Alice'
      });

      assert.deepEqual(result, {
        'age': 30,
        'name': 'Alice'
      });
    });

    void it('rejects string-as-integer for strict field even when global castTypes is on', () => {
      const registry = JsonTology.create({
        'baseIRI': 'urn:test:',
        'enableTypeCast': true
      });

      registry.register(StrictFieldSchema);

      assert.throws(() => {
        registry.instantiate(StrictFieldSchema.$id, {
          'age': '30',
          'name': 'Alice'
        });
      });
    });

    void it('coerces non-strict field normally when global castTypes is on', () => {
      const registry = JsonTology.create({
        'baseIRI': 'urn:test:',
        'enableTypeCast': true
      });

      registry.register(StrictFieldSchema);
      const result = registry.instantiate(StrictFieldSchema.$id, {
        'age': 30,
        'name': 42
      }) as Record<string, unknown>;

      assert.equal(result.name, '42');
    });

    void it('rejects boolean-as-integer for strict field', () => {
      const registry = JsonTology.create({
        'baseIRI': 'urn:test:',
        'enableTypeCast': true
      });

      registry.register(StrictFieldSchema);

      assert.throws(() => {
        registry.instantiate(StrictFieldSchema.$id, {
          'age': true,
          'name': 'Alice'
        });
      });
    });

    void it('accepts valid integer for strict field without castTypes', () => {
      const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });

      registry.register(StrictFieldSchema);
      const result = registry.instantiate(StrictFieldSchema.$id, {
        'age': 5,
        'name': 'Bob'
      });

      assert.deepEqual(result, {
        'age': 5,
        'name': 'Bob'
      });
    });

    void it('jt:config.strict applies to all fields when set', () => {
      const registry = JsonTology.create({
        'baseIRI': 'urn:test:',
        'enableTypeCast': true
      });

      registry.register(GlobalStrictConfigSchema);

      assert.throws(() => {
        registry.instantiate(GlobalStrictConfigSchema.$id, {
          'count': '5',
          'label': 'hello'
        });
      });
    });

    void it('jt:strict: false opts out field when jt:config.strict is true', () => {
      const registry = JsonTology.create({
        'baseIRI': 'urn:test:',
        'enableTypeCast': true
      });

      registry.register(GlobalStrictConfigSchema);
      const result = registry.instantiate(GlobalStrictConfigSchema.$id, {
        'count': 5,
        'label': 99
      }) as Record<string, unknown>;

      assert.equal(result.label, '99');
    });

    void it('validate() reflects strict type failures', () => {
      const registry = JsonTology.create({
        'baseIRI': 'urn:test:',
        'enableTypeCast': true
      });

      registry.register(StrictFieldSchema);
      const errors = registry.validate(StrictFieldSchema.$id, {
        'age': '30',
        'name': 'Alice'
      });

      assert.ok(errors.length > 0);
    });

    void it('is() returns false for strict field type mismatch', () => {
      const registry = JsonTology.create({
        'baseIRI': 'urn:test:',
        'enableTypeCast': true
      });

      registry.register(StrictFieldSchema);

      assert.equal(registry.is(StrictFieldSchema.$id, {
        'age': '30',
        'name': 'Alice'
      }), false);
    });

    void it('is() returns true for correct types even with jt:strict', () => {
      const registry = JsonTology.create({
        'baseIRI': 'urn:test:',
        'enableTypeCast': true
      });

      registry.register(StrictFieldSchema);

      assert.equal(registry.is(StrictFieldSchema.$id, {
        'age': 30,
        'name': 'Alice'
      }), true);
    });
  });
}

// ===========================================================================
// Source: frozenOutput.test.ts
// ===========================================================================
{
  const MetaSchema = {
    '$id': 'https://ex.io/Meta',
    'properties': { 'tag': { 'type': 'string' } },
    'type': 'object'
  } as const;

  const FrozenSchema = {
    '$id': 'https://ex.io/Frozen',
    'jt:frozen': true,
    'properties': {
      'meta': { '$ref': 'https://ex.io/Meta' },
      'name': { 'type': 'string' }
    },
    'required': ['name'],
    'type': 'object'
  } as const;

  const FrozenViaConfigSchema = {
    '$id': 'https://ex.io/FrozenViaConfig',
    'jt:config': { 'frozen': true },
    'properties': { 'value': { 'type': 'number' } },
    'required': ['value'],
    'type': 'object'
  } as const;

  const MutableSchema = {
    '$id': 'https://ex.io/Mutable',
    'properties': { 'value': { 'type': 'string' } },
    'required': ['value'],
    'type': 'object'
  } as const;

  const FrozenArraySchema = {
    '$id': 'https://ex.io/FrozenArray',
    'jt:frozen': true,
    'properties': {
      'items': {
        'items': { 'type': 'string' },
        'type': 'array'
      }
    },
    'required': ['items'],
    'type': 'object'
  } as const;

  void describe('jt:frozen output', { 'concurrency': true }, () => {
    void it('coerce() returns frozen object when jt:frozen is set', () => {
      const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });

      registry.register(FrozenSchema);
      registry.register(MetaSchema);
      const result = registry.instantiate(FrozenSchema.$id, { 'name': 'Alice' });

      assert.ok(Object.isFrozen(result));
    });

    void it('coerce() returns mutable object when jt:frozen is not set', () => {
      const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });

      registry.register(MutableSchema);
      const result = registry.instantiate(MutableSchema.$id, { 'value': 'hello' }) as Record<string, unknown>;

      assert.ok(!Object.isFrozen(result));
      result.value = 'mutated';
      assert.equal(result.value, 'mutated');
    });

    void it('mutation on frozen result throws in strict ESM mode', () => {
      const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });

      registry.register(FrozenSchema);
      registry.register(MetaSchema);
      const result = registry.instantiate(FrozenSchema.$id, { 'name': 'Bob' }) as Record<string, unknown>;

      assert.throws(() => {
        result.name = 'Charlie';
      }, TypeError);
    });

    void it('nested objects are also frozen (deep freeze)', () => {
      const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });

      registry.register(MetaSchema);
      registry.register(FrozenSchema);
      const result = registry.instantiate(FrozenSchema.$id, {
        'meta': { 'tag': 'test' },
        'name': 'Alice'
      }) as Record<string, unknown>;

      assert.ok(Object.isFrozen(result));
      assert.ok(Object.isFrozen(result.meta));
    });

    void it('arrays are frozen when parent has jt:frozen', () => {
      const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });

      registry.register(FrozenArraySchema);
      const result = registry.instantiate(FrozenArraySchema.$id, {
        'items': [
          'a',
          'b'
        ]
      }) as Record<string, unknown>;

      assert.ok(Object.isFrozen(result));
      assert.ok(Object.isFrozen(result.items));
    });

    void it('jt:config.frozen works as shorthand for jt:frozen', () => {
      const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });

      registry.register(FrozenViaConfigSchema);
      const result = registry.instantiate(FrozenViaConfigSchema.$id, { 'value': 42 });

      assert.ok(Object.isFrozen(result));
    });

    void it('materialize() returns frozen object when jt:frozen is set', () => {
      const jt = JsonTology.create({
        'baseIRI': 'https://ex.io',
        'schemas': [
          MetaSchema,
          FrozenSchema
        ] as const
      });
      const result = jt.materialize(FrozenSchema, { 'name': 'Alice' });

      assert.ok(Object.isFrozen(result));
    });

    void it('materialize() returns mutable object when jt:frozen is not set', () => {
      const jt = JsonTology.create({
        'baseIRI': 'https://ex.io',
        'schemas': [MutableSchema] as const
      });
      const result = jt.materialize(MutableSchema, { 'value': 'hello' }) as Record<string, unknown>;

      assert.ok(!Object.isFrozen(result));
    });

    void it('frozen output is cycle-safe (no infinite recursion)', () => {
      const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });

      registry.register(FrozenSchema);
      registry.register(MetaSchema);

      assert.doesNotThrow(() => {
        registry.instantiate(FrozenSchema.$id, { 'name': 'safe' });
      });
    });
  });
}

// ===========================================================================
// Source: enableDefaults.test.ts
// ===========================================================================
{
  const WithDefaultSchema = {
    '$id': 'urn:test:WithDefault',
    'properties': {
      'name': { 'type': 'string' },
      'role': {
        'default': 'user',
        'type': 'string'
      }
    },
    'required': ['name'],
    'type': 'object'
  } as const;

  void describe('enableDefaults option', { 'concurrency': true }, () => {
    void it('fills defaults by default (enableDefaults: true)', () => {
      const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });

      registry.register(WithDefaultSchema as unknown as Record<string, unknown>);

      const result = registry.instantiate(WithDefaultSchema.$id, { 'name': 'Alice' }) as Record<string, unknown>;

      assert.strictEqual(result.role, 'user', 'default should be filled');
    });

    void it('global opt-out: enableDefaults: false suppresses default-filling', () => {
      const registry = JsonTology.create({
        'baseIRI': 'urn:test:',
        'enableDefaults': false
      });

      registry.register(WithDefaultSchema as unknown as Record<string, unknown>);

      const result = registry.instantiate(WithDefaultSchema.$id, { 'name': 'Alice' }) as Record<string, unknown>;

      assert.strictEqual(result.role, undefined, 'default should NOT be filled');
    });

    void it('per-call opt-out overrides global true', () => {
      const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });

      registry.register(WithDefaultSchema as unknown as Record<string, unknown>);

      const result = registry.instantiate(
        WithDefaultSchema.$id,
        { 'name': 'Alice' },
        { 'enableDefaults': false }
      ) as Record<string, unknown>;

      assert.strictEqual(result.role, undefined, 'per-call false suppresses defaults');
    });

    void it('per-call opt-in overrides global false', () => {
      const registry = JsonTology.create({
        'baseIRI': 'urn:test:',
        'enableDefaults': false
      });

      registry.register(WithDefaultSchema as unknown as Record<string, unknown>);

      const result = registry.instantiate(
        WithDefaultSchema.$id,
        { 'name': 'Alice' },
        { 'enableDefaults': true }
      ) as Record<string, unknown>;

      assert.strictEqual(result.role, 'user', 'per-call true fills defaults');
    });

    void it('per-call options do not mutate registry stored default setting', () => {
      const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });

      registry.register(WithDefaultSchema as unknown as Record<string, unknown>);

      registry.instantiate(WithDefaultSchema.$id, { 'name': 'Alice' }, { 'enableDefaults': false });

      const result2 = registry.instantiate(WithDefaultSchema.$id, { 'name': 'Bob' }) as Record<string, unknown>;

      assert.strictEqual(result2.role, 'user', 'subsequent call uses global default (true)');
    });
  });
}

// ===========================================================================
// Source: enableStrictGraph.test.ts
// ===========================================================================
{
  const InlineObjectSchema = {
    '$id': 'urn:test:InlineObj',
    'properties': {
      'nested': {
        'properties': { 'x': { 'type': 'string' } },
        'type': 'object'
      }
    },
    'type': 'object'
  } as const;

  const InlinePrimitiveSchema = {
    '$id': 'urn:test:InlinePrim',
    'properties': {
      'isbn': {
        'pattern': '^\\d{13}$',
        'type': 'string'
      }
    },
    'type': 'object'
  } as const;

  const CleanSchema = {
    '$id': 'urn:test:Clean',
    'properties': { 'name': { 'type': 'string' } },
    'type': 'object'
  } as const;

  void describe('enableInlineWarnings flag', { 'concurrency': true }, () => {
    void it('emits warn via logger when inline-object found', () => {
      const warns: string[] = [];
      const registry = JsonTology.create({
        'baseIRI': 'urn:test:',
        'enableInlineWarnings': true,
        'logger': {
          'debug': (msg: string) => {
            warns.push(msg);
          },
          'error': (msg: string) => {
            warns.push(msg);
          },
          'fatal': (msg: string) => {
            warns.push(msg);
          },
          'info': (msg: string) => {
            warns.push(msg);
          },
          'trace': (msg: string) => {
            warns.push(msg);
          },
          'warn': (msg: string) => {
            warns.push(msg);
          }
        }
      });

      registry.register(InlineObjectSchema as unknown as Record<string, unknown>);
      assert.ok(warns.length > 0, 'warning emitted');
      assert.ok(warns.some((msg) => {
        return msg.includes('inline');
      }), 'warning mentions inline');
    });

    void it('is silent by default (no flags)', () => {
      const warns: string[] = [];
      const registry = JsonTology.create({
        'baseIRI': 'urn:test:',
        'logger': {
          'debug': (msg: string) => {
            warns.push(msg);
          },
          'error': (msg: string) => {
            warns.push(msg);
          },
          'fatal': (msg: string) => {
            warns.push(msg);
          },
          'info': (msg: string) => {
            warns.push(msg);
          },
          'trace': (msg: string) => {
            warns.push(msg);
          },
          'warn': (msg: string) => {
            warns.push(msg);
          }
        }
      });

      registry.register(InlineObjectSchema as unknown as Record<string, unknown>);
      const inlineWarns = warns.filter((msg) => {
        return msg.includes('inline');
      });

      assert.strictEqual(inlineWarns.length, 0, 'no inline warnings in default mode');
    });
  });

  void describe('enableStrictGraph flag', { 'concurrency': true }, () => {
    void it('throws SchemaError for inline-object', () => {
      const registry = JsonTology.create({
        'baseIRI': 'urn:test:',
        'enableStrictGraph': true
      });

      assert.throws(
        () => {
          registry.register(InlineObjectSchema as unknown as Record<string, unknown>);
        },
        (err: unknown) => {
          return err instanceof SchemaError && err.code === 'SCHEMA_STRUCTURE_INVALID';
        }
      );
    });

    void it('throws SchemaError for inline-primitive', () => {
      const registry = JsonTology.create({
        'baseIRI': 'urn:test:',
        'enableStrictGraph': true
      });

      assert.throws(
        () => {
          registry.register(InlinePrimitiveSchema as unknown as Record<string, unknown>);
        },
        (err: unknown) => {
          return err instanceof SchemaError && err.code === 'SCHEMA_STRUCTURE_INVALID';
        }
      );
    });

    void it('passes for clean schema with no inline shapes', () => {
      const registry = JsonTology.create({
        'baseIRI': 'urn:test:',
        'enableStrictGraph': true
      });

      assert.doesNotThrow(() => {
        registry.register(CleanSchema as unknown as Record<string, unknown>);
      });
    });

    void it('implies enableInlineWarnings (promotes warn to throw)', () => {
    // With strict, both inline-object and inline-primitive throw
      const strictRegistry = JsonTology.create({
        'baseIRI': 'urn:test:',
        'enableStrictGraph': true
      });

      assert.throws(() => {
        strictRegistry.register(InlineObjectSchema as unknown as Record<string, unknown>);
      });
      assert.throws(() => {
        strictRegistry.register(InlinePrimitiveSchema as unknown as Record<string, unknown>);
      });
    });

    void it('passes schema with allOf+$ref produced by Compose.extend', async () => {
      const { Compose } = await import('../../src/modules/composition/Compose.js');

      const ParentSchema = {
        '$id': 'urn:test:StrictParent',
        'properties': { 'name': { 'type': 'string' } },
        'type': 'object'
      } as const;

      const ChildSchema = Compose.extend(ParentSchema, { 'role': { 'type': 'string' } } as const, 'urn:test:StrictChild') as unknown as Record<string, unknown>;

      const registry = JsonTology.create({
        'baseIRI': 'urn:test:',
        'enableStrictGraph': true
      });

      assert.doesNotThrow(() => {
        registry.register(ParentSchema as unknown as Record<string, unknown>);
        registry.register(ChildSchema);
      });
    });
  });

  void describe('enableDuplicateDetection flag', { 'concurrency': true }, () => {
    void it('emits warn when duplicate shape detected at registration', () => {
      const IsbnSchema = {
        '$id': 'urn:test:DupIsbn',
        'pattern': '^\\d{13}$',
        'type': 'string'
      };

      const BookSchema = {
        '$id': 'urn:test:DupBook',
        'properties': {
          'isbn': {
            'pattern': '^\\d{13}$',
            'type': 'string'
          }
        },
        'type': 'object'
      };

      const warns: string[] = [];
      const registry = JsonTology.create({
        'baseIRI': 'urn:test:',
        'enableDuplicateDetection': true,
        'logger': {
          'debug': (msg: string) => {
            warns.push(msg);
          },
          'error': (msg: string) => {
            warns.push(msg);
          },
          'fatal': (msg: string) => {
            warns.push(msg);
          },
          'info': (msg: string) => {
            warns.push(msg);
          },
          'trace': (msg: string) => {
            warns.push(msg);
          },
          'warn': (msg: string) => {
            warns.push(msg);
          }
        }
      });

      registry.register(IsbnSchema);
      registry.register(BookSchema);

      const dupWarns = warns.filter((msg) => {
        return msg.toLowerCase().includes('duplicate');
      });

      assert.ok(dupWarns.length > 0, 'duplicate warning emitted');
    });
  });
}

