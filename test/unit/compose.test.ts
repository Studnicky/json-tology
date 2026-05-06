// Merged from: composition.test.ts, composeEdgeCases.test.ts, composeEquivalent.test.ts, composeExtendAllOf.test.ts
// Phase-1 mechanical consolidation per .audits/test-consolidation-2026-05.md

import assert from 'node:assert/strict';
// ValidationErrorType is the per-error structural type used in composition tests; not re-exported publicly.
import type { ValidationErrorType } from '../../src/types/Validation.js';
import {
  describe, it
} from 'node:test';
import {
  BaseError, Compose, InstantiationError, JsonTology, ValidationErrors
} from '../../src/index.js';
// Result monad is an internal validation primitive not surfaced via the public API;
// the Result.pass/fail/map/orElse/unwrap tests below exercise its monadic contract directly.
import { Result } from '../../src/modules/data/Result.js';

// ===========================================================================
// Source: composition.test.ts
// ===========================================================================
{
  const PersonSchema = {
    '$id': 'https://example.io/person',
    'additionalProperties': false,
    'properties': {
      'age': { 'type': 'number' },
      'email': { 'type': 'string' },
      'name': { 'type': 'string' }
    },
    'required': [
      'name',
      'age'
    ],
    'type': 'object'
  } as const;

  const AddressSchema = {
    '$id': 'https://example.io/address',
    'properties': {
      'city': { 'type': 'string' },
      'street': { 'type': 'string' }
    },
    'required': ['street'],
    'type': 'object'
  } as const;

  const UserSchema = {
    '$id': 'https://myapp.io/User',
    'properties': {
      'email': { 'type': 'string' },
      'id': { 'type': 'string' },
      'name': { 'type': 'string' },
      'role': {
        'default': 'user',
        'type': 'string'
      }
    },
    'required': [
      'id',
      'name'
    ],
    'type': 'object'
  } as const;

  const CircleSchema = {
    '$id': 'https://example.io/circle',
    'properties': {
      'kind': { 'const': 'circle' },
      'radius': { 'type': 'number' }
    },
    'required': ['kind'],
    'type': 'object'
  } as const;

  const RectSchema = {
    '$id': 'https://example.io/rect',
    'properties': {
      'kind': { 'const': 'rect' },
      'width': { 'type': 'number' }
    },
    'required': ['kind'],
    'type': 'object'
  } as const;

  // ---------------------------------------------------------------------------
  // extend
  // ---------------------------------------------------------------------------

  void describe('Compose.extend()', () => {
    type ExtResult = Record<string, unknown> & {
      '$id': string;
      'allOf': readonly [{ '$ref': string }, Record<string, unknown>];
    };

    const extendScenarios: Array<{
      'check': () => void;
      'name': string;
    }> = [
      {
        'check': () => {
          const schema = Compose.extend(
            PersonSchema,
            { 'role': { 'type': 'string' } } as const,
            'https://example.io/person-with-role'
          ) as unknown as ExtResult;

          assert.ok(Array.isArray(schema.allOf), 'has allOf');
          assert.strictEqual(schema.allOf[0].$ref, 'https://example.io/person', '$ref to parent');
          const additions = schema.allOf[1];
          const props = additions.properties as Record<string, unknown>;

          assert.ok('role' in props);
          assert.strictEqual(schema.$id, 'https://example.io/person-with-role');
        },
        'name': 'emits allOf+$ref shape with additions as second allOf member'
      },
      {
        'check': () => {
          Compose.extend(
            PersonSchema,
            { 'role': { 'type': 'string' } } as const,
            'https://example.io/person-mutate-check'
          );
          assert.ok(!('role' in PersonSchema.properties));
        },
        'name': 'does not mutate the source schema'
      },
      {
        'check': () => {
          const schema = Compose.extend(
            PersonSchema,
            {} as const,
            'https://example.io/person-empty-extend'
          ) as unknown as ExtResult;

          assert.ok(Array.isArray(schema.allOf), 'empty extend — has allOf');
          assert.strictEqual(schema.allOf[0].$ref, 'https://example.io/person', 'empty extend — $ref to parent');
        },
        'name': 'extends with empty properties still emits allOf+$ref shape'
      },
      {
        'check': () => {
          const schema = Compose.extend(
            UserSchema,
            { 'phone': { 'type': 'string' } } as const,
            'https://example.io/user-phone'
          ) as unknown as ExtResult;

          assert.ok(Array.isArray(schema.allOf), 'user phone — has allOf');
          assert.strictEqual(schema.allOf[0].$ref, 'https://myapp.io/User', 'user phone — $ref to parent');
          const addProps = schema.allOf[1].properties as Record<string, unknown>;

          assert.ok('phone' in addProps, 'user phone — phone in additions');
        },
        'name': 'extensions block contains additional properties'
      }
    ];

    for (const {
      'check': checkFn, 'name': scenarioName
    } of extendScenarios) {
      void it(scenarioName, () => {
        checkFn();
      });
    }
  });

  // ---------------------------------------------------------------------------
  // intersection
  // ---------------------------------------------------------------------------

  void describe('Compose.intersection()', () => {
    const intersectionScenarios: Array<{
      'check': (result: Record<string, unknown>) => void;
      'name': string;
      'newId': string;
      'schemas': ReadonlyArray<Record<string, unknown>>;
    }> = [
      {
        'check': (result) => {
          assert.ok('allOf' in result);
          const allOf = result.allOf as unknown[];

          assert.strictEqual(allOf.length, 2);
          assert.strictEqual(result.$id, 'https://example.io/Combined');
          assert.deepStrictEqual(allOf[0], PersonSchema);
          assert.deepStrictEqual(allOf[1], AddressSchema);
        },
        'name': 'wraps schemas in allOf and sets $id',
        'newId': 'https://example.io/Combined',
        'schemas': [
          PersonSchema,
          AddressSchema
        ]
      },
      {
        'check': () => {
          const before = { ...PersonSchema };

          Compose.intersection([
            PersonSchema,
            AddressSchema
          ], 'https://example.io/Combined3');
          assert.deepStrictEqual(PersonSchema.required, before.required);
        },
        'name': 'does not mutate source schemas',
        'newId': 'https://example.io/Combined2',
        'schemas': [
          PersonSchema,
          AddressSchema
        ]
      },
      {
        'check': (result) => {
          assert.ok('allOf' in result);
          const allOf = result.allOf as unknown[];

          assert.strictEqual(allOf.length, 1);
          assert.deepStrictEqual(allOf[0], PersonSchema);
        },
        'name': 'works with a single schema',
        'newId': 'https://example.io/SingleIntersect',
        'schemas': [PersonSchema]
      }
    ];

    for (const {
      'check': checkFn, 'name': scenarioName, 'newId': id, 'schemas': schemaList
    } of intersectionScenarios) {
      void it(scenarioName, () => {
        const result = Compose.intersection(schemaList, id);

        checkFn(result as unknown as Record<string, unknown>);
      });
    }
  });

  // ---------------------------------------------------------------------------
  // discriminatedUnion
  // ---------------------------------------------------------------------------

  void describe('Compose.discriminatedUnion()', () => {
    const duScenarios: Array<{
      'check': () => void;
      'name': string;
    }> = [
      {
        'check': () => {
          const result = Compose.discriminatedUnion('kind', [
            CircleSchema,
            RectSchema
          ], 'https://example.io/Shape');

          assert.ok('oneOf' in result);
          assert.strictEqual(result.oneOf.length, 2);
          assert.deepStrictEqual(result.discriminator, { 'propertyName': 'kind' });
          assert.strictEqual(result.$id, 'https://example.io/Shape');
          assert.deepStrictEqual(result.oneOf[0], CircleSchema);
          assert.deepStrictEqual(result.oneOf[1], RectSchema);
        },
        'name': 'wraps variants in oneOf with discriminator and sets $id'
      },
      {
        'check': () => {
          const result = Compose.discriminatedUnion('kind', [CircleSchema], 'https://example.io/SingleShape');

          assert.ok('oneOf' in result);
          assert.strictEqual(result.oneOf.length, 1);
        },
        'name': 'works with single variant'
      }
    ];

    for (const {
      'check': checkFn, 'name': scenarioName
    } of duScenarios) {
      void it(scenarioName, () => {
        checkFn();
      });
    }
  });

  // ---------------------------------------------------------------------------
  // partial
  // ---------------------------------------------------------------------------

  void describe('Compose.partial()', () => {
    const partialScenarios: Array<{
      'check': () => void;
      'name': string;
    }> = [
      {
        'check': () => {
          const schema = Compose.partial(UserSchema, 'https://myapp.io/PartialUser');

          assert.ok(!('required' in schema));
          assert.ok('id' in schema.properties);
          assert.ok('name' in schema.properties);
          assert.equal(schema.$id, 'https://myapp.io/PartialUser');
        },
        'name': 'makes all fields optional and preserves properties'
      },
      {
        'check': () => {
          const reg = JsonTology.create({ 'baseIRI': 'urn:test:' });
          const schema = Compose.partial(UserSchema, 'https://myapp.io/PartialUser2');

          reg.register(schema);
          assert.equal(reg.validate(schema.$id, {}).length, 0);
        },
        'name': 'validates with empty object (all optional)'
      }
    ];

    for (const {
      'check': checkFn, 'name': scenarioName
    } of partialScenarios) {
      void it(scenarioName, () => {
        checkFn();
      });
    }
  });

  // ---------------------------------------------------------------------------
  // required
  // ---------------------------------------------------------------------------

  void describe('Compose.required()', () => {
    const requiredScenarios: Array<{
      'check': () => void;
      'name': string;
    }> = [
      {
        'check': () => {
          const schema = Compose.required(UserSchema, 'https://myapp.io/StrictUser');

          assert.deepEqual(
            [...schema.required].sort(),
            [
              'email',
              'id',
              'name',
              'role'
            ].sort()
          );
        },
        'name': 'makes every property required'
      },
      {
        'check': () => {
          const reg = JsonTology.create({ 'baseIRI': 'urn:test:' });
          const schema = Compose.required(UserSchema, 'https://myapp.io/StrictUser2');

          reg.register(schema);
          assert.ok(reg.validate(schema.$id, {
            'id': '1',
            'name': 'Alice'
          }).length > 0);
        },
        'name': 'fails validation when required fields are missing'
      },
      {
        'check': () => {
          const reg = JsonTology.create({ 'baseIRI': 'urn:test:' });
          const schema = Compose.required(UserSchema, 'https://myapp.io/StrictUser3');

          reg.register(schema);
          assert.equal(reg.validate(schema.$id, {
            'email': 'a@b.com',
            'id': '1',
            'name': 'Alice',
            'role': 'admin'
          }).length, 0);
        },
        'name': 'passes validation when all fields present'
      }
    ];

    for (const {
      'check': checkFn, 'name': scenarioName
    } of requiredScenarios) {
      void it(scenarioName, () => {
        checkFn();
      });
    }
  });

  // ---------------------------------------------------------------------------
  // pick
  // ---------------------------------------------------------------------------

  void describe('Compose.pick()', () => {
    const pickScenarios: Array<{
      'check': () => void;
      'name': string;
    }> = [
      {
        'check': () => {
          const schema = Compose.pick(UserSchema, [
            'id',
            'name'
          ] as const, 'https://myapp.io/UserSummary');

          assert.ok('id' in schema.properties);
          assert.ok('name' in schema.properties);
          assert.ok(!('email' in schema.properties));
          assert.deepEqual([...schema.required].sort(), [
            'id',
            'name'
          ].sort());
        },
        'name': 'retains only picked properties with correct required status'
      },
      {
        'check': () => {
          const emailOnly = Compose.pick(UserSchema, ['email'] as const, 'https://myapp.io/EmailOnly');

          assert.ok(!('required' in emailOnly) || emailOnly.required.length === 0);
        },
        'name': 'non-required picked fields remain optional'
      },
      {
        'check': () => {
          const reg = JsonTology.create({ 'baseIRI': 'urn:test:' });
          const schema = Compose.pick(UserSchema, [
            'id',
            'name'
          ] as const, 'https://myapp.io/UserSummary3');

          reg.register(schema);
          assert.equal(reg.validate(schema.$id, {
            'id': '1',
            'name': 'Alice'
          }).length, 0);
          assert.ok(reg.validate(schema.$id, { 'name': 'Alice' }).length > 0);
        },
        'name': 'validates picked schema correctly'
      },
      {
        'check': () => {
          const schema = Compose.pick(UserSchema, [] as const, 'https://myapp.io/EmptyPick');

          assert.equal(Object.keys(schema.properties).length, 0);
        },
        'name': 'pick with zero keys produces schema with no properties'
      }
    ];

    for (const {
      'check': checkFn, 'name': scenarioName
    } of pickScenarios) {
      void it(scenarioName, () => {
        checkFn();
      });
    }
  });

  // ---------------------------------------------------------------------------
  // omit
  // ---------------------------------------------------------------------------

  void describe('Compose.omit()', () => {
    const omitScenarios: Array<{
      'check': () => void;
      'name': string;
    }> = [
      {
        'check': () => {
          const schema = Compose.omit(UserSchema, [
            'email',
            'role'
          ] as const, 'https://myapp.io/PublicUser');

          assert.ok(!('email' in schema.properties));
          assert.ok(!('role' in schema.properties));
          assert.ok('id' in schema.properties);
        },
        'name': 'removes omitted properties and retains the rest'
      },
      {
        'check': () => {
          const noId = Compose.omit(UserSchema, ['id'] as const, 'https://myapp.io/NoId');

          assert.ok(!noId.required.includes('id'));
          assert.ok(noId.required.includes('name'));
        },
        'name': 'removes omitted key from required array'
      },
      {
        'check': () => {
          const reg = JsonTology.create({ 'baseIRI': 'urn:test:' });
          const schema = Compose.omit(UserSchema, [
            'email',
            'role'
          ] as const, 'https://myapp.io/PublicUser2');

          reg.register(schema);
          assert.equal(reg.validate(schema.$id, {
            'id': '1',
            'name': 'Alice'
          }).length, 0);
        },
        'name': 'validates omitted schema correctly'
      },
      {
        'check': () => {
          const schema = Compose.omit(UserSchema, [
            'id',
            'name',
            'email',
            'role'
          ] as const, 'https://myapp.io/OmitAll');

          assert.equal(Object.keys(schema.properties).length, 0);
        },
        'name': 'omit all keys produces schema with no properties'
      }
    ];

    for (const {
      'check': checkFn, 'name': scenarioName
    } of omitScenarios) {
      void it(scenarioName, () => {
        checkFn();
      });
    }
  });

  // ---------------------------------------------------------------------------
  // narrow
  // ---------------------------------------------------------------------------

  void describe('Compose.narrow()', () => {
    const narrowScenarios: Array<{
      'expected': string;
      'key': string;
      'name': string;
      'result': boolean;
      'value': unknown;
    }> = [
      {
        'expected': 'circle',
        'key': 'kind',
        'name': 'matches when discriminator value equals expected',
        'result': true,
        'value': {
          'kind': 'circle',
          'radius': 5
        }
      },
      {
        'expected': 'circle',
        'key': 'kind',
        'name': 'rejects when discriminator value differs',
        'result': false,
        'value': {
          'kind': 'rect',
          'width': 10
        }
      },
      {
        'expected': 'circle',
        'key': 'kind',
        'name': 'rejects null value',
        'result': false,
        'value': null
      },
      {
        'expected': 'circle',
        'key': 'kind',
        'name': 'rejects undefined value',
        'result': false,
        'value': undefined
      },
      {
        'expected': 'circle',
        'key': 'kind',
        'name': 'rejects string value',
        'result': false,
        'value': 'string'
      },
      {
        'expected': 'circle',
        'key': 'kind',
        'name': 'rejects object missing discriminator key',
        'result': false,
        'value': { 'radius': 5 }
      },
      {
        'expected': 'circle',
        'key': 'kind',
        'name': 'rejects array value',
        'result': false,
        'value': ['circle']
      }
    ];

    for (const {
      'expected': exp, 'key': k, 'name': scenarioName, 'result': res, 'value': val
    } of narrowScenarios) {
      void it(scenarioName, () => {
        assert.equal(Compose.narrow(val, k, exp), res);
      });
    }
  });

  // ---------------------------------------------------------------------------
  // getDefaults
  // ---------------------------------------------------------------------------

  void describe('Compose.getDefaults()', () => {
    const defaultScenarios: Array<{
      'check': (defaults: Record<string, unknown>) => void;
      'name': string;
      'schema': Record<string, unknown>;
    }> = [
      {
        'check': (defaults) => {
          assert.equal(defaults.name, 'Alice');
          assert.equal(defaults.active, true);
          assert.equal('age' in defaults, false);
        },
        'name': 'extracts scalar defaults and omits no-default properties',
        'schema': {
          'properties': {
            'active': {
              'default': true,
              'type': 'boolean'
            },
            'age': { 'type': 'number' },
            'name': {
              'default': 'Alice',
              'type': 'string'
            }
          },
          'required': [
            'name',
            'age'
          ],
          'type': 'object'
        }
      },
      {
        'check': (defaults) => {
          const nested = defaults.nested as Record<string, unknown>;

          assert.equal(typeof nested, 'object');
          assert.equal(nested.count, 0);
          assert.equal('label' in nested, false);
        },
        'name': 'recurses into nested object defaults',
        'schema': {
          'properties': {
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
          'type': 'object'
        }
      },
      {
        'check': (defaults) => {
          assert.deepEqual(defaults, {});
        },
        'name': 'returns empty object when no properties have defaults',
        'schema': {
          'properties': { 'x': { 'type': 'string' } },
          'type': 'object'
        }
      },
      {
        'check': (defaults) => {
          assert.deepEqual(defaults, {});
        },
        'name': 'returns empty object for bare object schema',
        'schema': { 'type': 'object' }
      }
    ];

    for (const {
      'check': checkFn, 'name': scenarioName, 'schema': s
    } of defaultScenarios) {
      void it(scenarioName, () => {
        const defaults = Compose.getDefaults(s);

        checkFn(defaults);
      });
    }

    void it('deep-clones default arrays so mutations do not leak', () => {
      const arraySchema = {
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
      const d1 = Compose.getDefaults(arraySchema);
      const d2 = Compose.getDefaults(arraySchema);

      (d1.tags as string[]).push('c');
      assert.deepEqual(d2.tags, [
        'a',
        'b'
      ]);
    });
  });

  // ---------------------------------------------------------------------------
  // ValidationErrors
  // ---------------------------------------------------------------------------

  void describe('ValidationErrors', () => {
    const formatScenarios: Array<{
      'check': (errs: ValidationErrors) => void;
      'items': Array<{ 'keyword': string;
        'message': string;
        'params': Record<string, unknown>;
        'path': string }>;
      'name': string;
    }> = [
      {
        'check': (errs) => {
        // Recipe: group by path (replaces removed format())
          const grouped: Record<string, ValidationErrorType[]> = {};

          for (const err of errs) {
            (grouped[err.path || '_root'] ??= []).push(err);
          }

          assert.deepEqual((grouped['/name'] ?? []).map((err) => {
            return err.message;
          }), [
            'must be string',
            'min length'
          ]);
          assert.deepEqual((grouped['/email'] ?? []).map((err) => {
            return err.message;
          }), ['invalid format']);
        },
        'items': [
          {
            'keyword': 'type',
            'message': 'must be string',
            'params': {},
            'path': '/name'
          },
          {
            'keyword': 'minLength',
            'message': 'min length',
            'params': {},
            'path': '/name'
          },
          {
            'keyword': 'format',
            'message': 'invalid format',
            'params': {},
            'path': '/email'
          }
        ],
        'name': 'items grouped by path (recipe for removed format())'
      },
      {
        'check': (errs) => {
        // Recipe: group by path (replaces removed format())
          const grouped: Record<string, ValidationErrorType[]> = {};

          for (const err of errs) {
            (grouped[err.path || '_root'] ??= []).push(err);
          }

          assert.deepEqual(grouped._root.map((err) => {
            return err.message;
          }), ['must be object']);
        },
        'items': [{
          'keyword': 'type',
          'message': 'must be object',
          'params': {},
          'path': ''
        }],
        'name': 'items grouped — root keyed as _root (recipe for removed format())'
      },
      {
        'check': (errs) => {
        // Recipe: field vs form errors (replaces removed flatten())
          const fieldErrors: ValidationErrorType[] = [];
          const formErrors: ValidationErrorType[] = [];

          for (const err of errs) {
            if (err.path) {
              fieldErrors.push(err);
            } else {
              formErrors.push(err);
            }
          }

          assert.deepEqual(
            fieldErrors.filter((err) => {
              return err.path === '/name';
            }).map((err) => {
              return err.message;
            }),
            ['must be string']
          );
          assert.deepEqual(formErrors.map((err) => {
            return err.message;
          }), ['must be object']);
        },
        'items': [
          {
            'keyword': 'type',
            'message': 'must be string',
            'params': {},
            'path': '/name'
          },
          {
            'keyword': 'type',
            'message': 'must be object',
            'params': {},
            'path': ''
          }
        ],
        'name': 'items split into field and form errors (recipe for removed flatten())'
      }
    ];

    for (const {
      'check': checkFn, 'items': errItems, 'name': scenarioName
    } of formatScenarios) {
      void it(scenarioName, () => {
        const errs = new ValidationErrors(errItems);

        checkFn(errs);
      });
    }

    const metaScenarios: Array<{
      'check': (errs: ValidationErrors) => void;
      'items': Array<{ 'keyword': string;
        'message': string;
        'params': Record<string, unknown>;
        'path': string }>;
      'name': string;
    }> = [
      {
        'check': (errs) => {
          assert.equal(errs.ok, true);
        },
        'items': [],
        'name': 'ok is true for empty errors'
      },
      {
        'check': (errs) => {
          assert.equal(errs.ok, false);
        },
        'items': [{
          'keyword': 'k',
          'message': 'x',
          'params': {},
          'path': ''
        }],
        'name': 'ok is false for non-empty errors'
      },
      {
        'check': (errs) => {
          const items = [{
            'keyword': 'k',
            'message': 'x',
            'params': {},
            'path': '/a'
          }];

          assert.deepEqual([...errs], items);
        },
        'items': [{
          'keyword': 'k',
          'message': 'x',
          'params': {},
          'path': '/a'
        }],
        'name': 'is iterable over items'
      },
      {
        'check': (errs) => {
        // Recipe: path-prefixed messages (replaces removed messages())
          const msgs = errs.items.map((err) => {
            return `${err.path || 'root'}: ${err.message}`;
          });

          assert.deepEqual(msgs, [
            '/name: bad',
            'root: root error'
          ]);
        },
        'items': [
          {
            'keyword': 'type',
            'message': 'bad',
            'params': {},
            'path': '/name'
          },
          {
            'keyword': 'type',
            'message': 'root error',
            'params': {},
            'path': ''
          }
        ],
        'name': 'items mapped to path-prefixed strings (recipe for removed messages())'
      }
    ];

    for (const {
      'check': checkFn, 'items': errItems, 'name': scenarioName
    } of metaScenarios) {
      void it(scenarioName, () => {
        const errs = new ValidationErrors(errItems);

        checkFn(errs);
      });
    }

    const fromValidatorScenarios: Array<{
      'check': (mapped: ValidationErrors) => void;
      'input': unknown;
      'name': string;
    }> = [
      {
        'check': (mapped) => {
          assert.equal(mapped.length, 2);
          assert.equal(mapped.items[0].path, '/name');
          assert.equal(mapped.items[0].message, 'must be string');
          assert.equal(mapped.items[1].message, 'Validation failed');
        },
        'input': [
          {
            'instancePath': '/name',
            'keyword': 'type',
            'message': 'must be string',
            'params': {}
          },
          {
            'instancePath': '/age',
            'keyword': 'minimum',
            'params': { 'limit': 0 }
          }
        ],
        'name': 'maps external validator errors with instancePath and message'
      },
      {
        'check': (mapped) => {
          assert.equal(mapped.length, 1);
          assert.equal(mapped.items[0].keyword, 'unknown');
        },
        'input': null,
        'name': 'null input produces single unknown error'
      },
      {
        'check': (mapped) => {
          assert.equal(mapped.length, 1);
          assert.equal(mapped.items[0].keyword, 'unknown');
        },
        'input': undefined,
        'name': 'undefined input produces single unknown error'
      },
      {
        'check': (mapped) => {
          assert.equal(mapped.length, 1);
          assert.equal(mapped.items[0].keyword, 'unknown');
        },
        'input': [],
        'name': 'empty array produces single unknown error'
      }
    ];

    for (const {
      'check': checkFn, 'input': inp, 'name': scenarioName
    } of fromValidatorScenarios) {
      void it(scenarioName, () => {
        const mapped = inp === undefined
          ? ValidationErrors.fromValidatorErrors()
          : ValidationErrors.fromValidatorErrors(inp as Array<Record<string, unknown>> | null);

        checkFn(mapped);
      });
    }
  });

  // ---------------------------------------------------------------------------
  // Result monad
  // ---------------------------------------------------------------------------

  void describe('Result', () => {
    const resultScenarios: Array<{
      'check': () => void;
      'name': string;
    }> = [
      {
        'check': () => {
          const ok = Result.pass(42);

          assert.equal(ok.success, true);
          assert.equal(ok.data, 42);
          assert.equal(ok.errors, undefined);
        },
        'name': 'pass: success=true, data present, no errors'
      },
      {
        'check': () => {
          const errs = new ValidationErrors([{
            'keyword': 'type',
            'message': 'bad',
            'params': {},
            'path': '/x'
          }]);
          const fail = Result.fail<number>(errs);

          assert.equal(fail.success, false);
          assert.equal(fail.data, undefined);
          assert.equal(fail.errors, errs);
        },
        'name': 'fail: success=false, errors present, no data'
      },
      {
        'check': () => {
          const ok = Result.pass(42);
          const mapped = ok.map((val) => {
            return val * 2;
          });

          assert.equal(mapped.success, true);
          assert.equal(mapped.data, 84);
        },
        'name': 'map transforms success value'
      },
      {
        'check': () => {
          const errs = new ValidationErrors([{
            'keyword': 'type',
            'message': 'bad',
            'params': {},
            'path': '/x'
          }]);
          const fail = Result.fail<number>(errs);
          const failMapped = fail.map((val) => {
            return val * 2;
          });

          assert.equal(failMapped.success, false);
          assert.equal(failMapped.data, undefined);
        },
        'name': 'map passes failure through unchanged'
      },
      {
        'check': () => {
          const ok = Result.pass(42);

          assert.equal(ok.orElse(() => {
            return -1;
          }), 42);
        },
        'name': 'orElse returns data on success'
      },
      {
        'check': () => {
          const errs = new ValidationErrors([{
            'keyword': 'type',
            'message': 'bad',
            'params': {},
            'path': '/x'
          }]);
          const fail = Result.fail<number>(errs);

          assert.equal(fail.orElse(() => {
            return -1;
          }), -1);
        },
        'name': 'orElse returns fallback on failure'
      },
      {
        'check': () => {
          assert.equal(Result.pass(42).unwrap(), 42);
        },
        'name': 'unwrap returns data on success'
      },
      {
        'check': () => {
          const errs = new ValidationErrors([{
            'keyword': 'type',
            'message': 'bad',
            'params': {},
            'path': '/x'
          }]);
          const fail = Result.fail<number>(errs);

          assert.throws(
            () => {
              return fail.unwrap();
            },
            (err: unknown) => {
              return err instanceof InstantiationError;
            }
          );
        },
        'name': 'unwrap throws InstantiationError on failure'
      }
    ];

    for (const {
      'check': checkFn, 'name': scenarioName
    } of resultScenarios) {
      void it(scenarioName, () => {
        checkFn();
      });
    }
  });

  // ---------------------------------------------------------------------------
  // Error class toJson(), flatten(), and cause chain
  // ---------------------------------------------------------------------------

  void describe('Error classes', () => {
    const baseErrorScenarios: Array<{
      'check': () => void;
      'name': string;
    }> = [
      {
        'check': () => {
          const simple = new BaseError('TEST_CODE', 'simple message', true);
          const json = simple.toJson();

          assert.equal(json.code, 'TEST_CODE');
          assert.equal(json.message, 'simple message');
          assert.equal(json.retryable, true);
          assert.equal(json.cause, undefined);
        },
        'name': 'toJson serializes without cause'
      },
      {
        'check': () => {
          const inner = new BaseError('INNER', 'inner error');
          const outer = new BaseError('OUTER', 'outer error', false, { 'cause': inner });
          const outerJson = outer.toJson();

          assert.equal(outerJson.cause.code, 'INNER');
          assert.equal(outerJson.cause.message, 'inner error');
        },
        'name': 'toJson serializes with BaseError cause'
      },
      {
        'check': () => {
          const plain = new BaseError('WRAP', 'wrapped', false, { 'cause': new Error('plain') });
          const plainJson = plain.toJson();

          assert.equal(plainJson.cause.code, 'UNKNOWN');
          assert.equal(plainJson.cause.message, 'plain');
        },
        'name': 'toJson wraps plain Error cause as UNKNOWN'
      },
      {
        'check': () => {
          const deep = new BaseError('L1', 'level 1', false, { 'cause': new BaseError('L2', 'level 2', false, { 'cause': new BaseError('L3', 'level 3') }) });
          const chain = deep.flatten();

          assert.equal(chain.length, 3);
          assert.equal(chain[0].code, 'L1');
          assert.equal(chain[1].code, 'L2');
          assert.equal(chain[2].code, 'L3');
        },
        'name': 'flatten walks the full cause chain'
      }
    ];

    for (const {
      'check': checkFn, 'name': scenarioName
    } of baseErrorScenarios) {
      void it(scenarioName, () => {
        checkFn();
      });
    }

    const coercionErrorScenarios: Array<{
      'check': () => void;
      'name': string;
    }> = [
      {
        'check': () => {
          const items = [
            {
              'keyword': 'required',
              'message': 'missing name',
              'params': {},
              'path': '/name'
            },
            {
              'keyword': 'type',
              'message': 'must be number',
              'params': {},
              'path': '/age'
            }
          ];
          const err = new InstantiationError(items);
          const flat = err.flatten();

          assert.equal(flat.length, 3);
          assert.equal(flat[0].code, 'INSTANTIATION_FAILED');
          assert.equal(flat[1].code, 'required');
          assert.ok(flat[1].message.includes('missing name'));
          assert.equal(flat[2].code, 'type');
        },
        'name': 'flatten appends validation items after base entry'
      },
      {
        'check': () => {
          const items = [
            {
              'keyword': 'required',
              'message': 'missing name',
              'params': {},
              'path': '/name'
            },
            {
              'keyword': 'type',
              'message': 'must be number',
              'params': {},
              'path': '/age'
            }
          ];
          const err = new InstantiationError(items);
          const json = err.toJson();

          assert.equal(json.code, 'INSTANTIATION_FAILED');
          assert.ok('errors' in json);
          const errors = (json as Record<string, unknown>).errors as Array<Record<string, unknown>>;

          assert.equal(errors.length, 2);
          assert.equal(errors[0].keyword, 'required');
          assert.equal(errors[1].path, '/age');
        },
        'name': 'toJson includes errors array'
      }
    ];

    for (const {
      'check': checkFn, 'name': scenarioName
    } of coercionErrorScenarios) {
      void it(scenarioName, () => {
        checkFn();
      });
    }
  });
}

// ===========================================================================
// Source: composeEdgeCases.test.ts
// ===========================================================================
{
  const BaseSchema = {
    '$id': 'https://example.io/base',
    'properties': {
      'age': { 'type': 'number' },
      'email': { 'type': 'string' },
      'name': { 'type': 'string' }
    },
    'required': [
      'name',
      'age'
    ],
    'type': 'object'
  } as const;

  // ---------------------------------------------------------------------------
  // extend — allOf+$ref shape
  // ---------------------------------------------------------------------------

  type AllOfResult = Record<string, unknown> & {
    '$id': string;
    'allOf': readonly [{ '$ref': string }, Record<string, unknown>];
  };

  type ComposeResult = Record<string, unknown> & {
    '$id': string;
    'properties': Record<string, unknown>;
    'required': string[];
  };

  interface ExtendScenario {
    'additionalProps': Record<string, { readonly 'type': string }>;
    'assertions': (result: AllOfResult) => void;
    'name': string;
    'newId': string;
  }

  const extendScenarios: ExtendScenario[] = [
    {
      'additionalProps': {},
      'assertions': (result) => {
        assert.strictEqual(result.$id, 'https://example.io/extended-empty', 'extend empty — $id');
        assert.ok(Array.isArray(result.allOf), 'extend empty — has allOf');
        assert.strictEqual((result.allOf[0] as Record<string, unknown>).$ref, 'https://example.io/base', 'extend empty — $ref points to parent');
      },
      'name': 'returns allOf+$ref when additional properties is empty',
      'newId': 'https://example.io/extended-empty'
    },
    {
      'additionalProps': { 'flag': { 'type': 'boolean' } },
      'assertions': (result) => {
        assert.strictEqual(result.$id, '', 'edge: extend empty $id — $id is empty string');
        assert.ok(Array.isArray(result.allOf), 'edge: extend empty $id — has allOf');
      },
      'name': 'edge: extend with empty $id produces schema with empty string $id',
      'newId': ''
    },
    {
      'additionalProps': { 'role': { 'type': 'string' } },
      'assertions': (result) => {
        assert.strictEqual(result.$id, 'https://example.io/base', 'extend same $id — $id preserved');
        assert.ok(Array.isArray(result.allOf), 'extend same $id — has allOf');
        const additionsProps = (result.allOf[1].properties ?? {}) as Record<string, unknown>;

        assert.ok('role' in additionsProps, 'extend same $id — role in additions');
      },
      'name': 'preserves $id from base when newId matches original — but newId always wins',
      'newId': 'https://example.io/base'
    },
    {
      'additionalProps': { 'extra': { 'type': 'boolean' } },
      'assertions': (result) => {
        assert.strictEqual(result.$id, 'https://example.io/base', 'extend $id handling — $id preserved');
        assert.ok(Array.isArray(result.allOf), 'extend $id handling — has allOf');
      },
      'name': 'preserves base $id when newId matches original',
      'newId': 'https://example.io/base'
    }
  ];

  void describe('Compose.extend() edge cases', () => {
    for (const scenario of extendScenarios) {
      void it(scenario.name, () => {
        const result = Compose.extend(
          BaseSchema,
          scenario.additionalProps as Record<string, never>,
          scenario.newId
        ) as unknown as AllOfResult;

        scenario.assertions(result);
      });
    }
  });

  // ---------------------------------------------------------------------------
  // pick
  // ---------------------------------------------------------------------------

  interface PickScenario {
    'assertions': (result: ComposeResult) => void;
    'keys': readonly string[];
    'name': string;
    'newId': string;
  }

  const pickScenarios: PickScenario[] = [
    {
      'assertions': (result) => {
        assert.strictEqual(result.$id, 'https://example.io/pick-empty', 'pick zero keys — $id');
        assert.deepStrictEqual(result.properties, {}, 'pick zero keys — properties');
        assert.strictEqual(result.type, 'object', 'pick zero keys — type');
        assert.ok(!('required' in result) || result.required.length === 0, 'pick zero keys — required');
      },
      'keys': [],
      'name': 'returns schema with type:object and no properties when picking zero keys',
      'newId': 'https://example.io/pick-empty'
    },
    {
      'assertions': (result) => {
        assert.strictEqual(result.$id, 'https://example.io/pick-missing', 'pick non-existent — $id');
        assert.deepStrictEqual(result.properties, {}, 'pick non-existent — properties');
        assert.ok(!('required' in result) || result.required.length === 0, 'pick non-existent — required');
      },
      'keys': [
        'nonexistent',
        'alsoMissing'
      ],
      'name': 'ignores properties that do not exist on source',
      'newId': 'https://example.io/pick-missing'
    },
    {
      'assertions': (result) => {
        assert.strictEqual(result.$id, 'https://example.io/pick-ghost', 'edge: pick non-existent single — $id');
        assert.deepStrictEqual(result.properties, {}, 'edge: pick non-existent single — empty properties');
      },
      'keys': ['ghost'],
      'name': 'edge: pick with single non-existent property returns empty schema',
      'newId': 'https://example.io/pick-ghost'
    }
  ];

  void describe('Compose.pick() edge cases', () => {
    for (const scenario of pickScenarios) {
      void it(scenario.name, () => {
        const result = Compose.pick(
          BaseSchema,
          scenario.keys as unknown as readonly never[],
          scenario.newId
        ) as unknown as ComposeResult;

        scenario.assertions(result);
      });
    }
  });

  // ---------------------------------------------------------------------------
  // omit
  // ---------------------------------------------------------------------------

  interface OmitScenario {
    'assertions': (result: ComposeResult) => void;
    'keys': readonly string[];
    'name': string;
    'newId': string;
  }

  const omitScenarios: OmitScenario[] = [
    {
      'assertions': (result) => {
        assert.strictEqual(result.$id, 'https://example.io/omit-all-required', 'omit all required — $id');
        assert.ok(!('name' in result.properties), 'omit all required — name removed');
        assert.ok(!('age' in result.properties), 'omit all required — age removed');
        assert.ok('email' in result.properties, 'omit all required — email remains');
        assert.ok(!('required' in result), 'omit all required — required absent');
      },
      'keys': [
        'name',
        'age'
      ],
      'name': 'produces empty or absent required array when all required fields are removed',
      'newId': 'https://example.io/omit-all-required'
    },
    {
      'assertions': (result) => {
        assert.ok(!('name' in result.properties), 'omit name — name removed');
        assert.ok('age' in result.properties, 'omit name — age remains');
        assert.ok('email' in result.properties, 'omit name — email remains');
        assert.ok(result.required.includes('age'), 'omit name — age still required');
        assert.ok(!result.required.includes('name'), 'omit name — name no longer required');
      },
      'keys': ['name'],
      'name': 'updates required array when a required property is removed',
      'newId': 'https://example.io/omit-name'
    }
  ];

  void describe('Compose.omit() edge cases', () => {
    for (const scenario of omitScenarios) {
      void it(scenario.name, () => {
        const result = Compose.omit(
          BaseSchema,
          scenario.keys as unknown as readonly never[],
          scenario.newId
        ) as unknown as ComposeResult;

        scenario.assertions(result);
      });
    }
  });

  // ---------------------------------------------------------------------------
  // partial
  // ---------------------------------------------------------------------------

  interface PartialScenario {
    'assertions': (result: ComposeResult) => void;
    'name': string;
    'newId': string;
    'schema': Record<string, unknown>;
  }

  const partialScenarios: PartialScenario[] = [
    {
      'assertions': (result) => {
        assert.strictEqual(result.$id, 'https://example.io/still-optional', 'partial no-op — $id');
        assert.ok(!('required' in result), 'partial no-op — required absent');
        assert.ok('tag' in result.properties, 'partial no-op — tag present');
      },
      'name': 'is a no-op on a schema that already has no required',
      'newId': 'https://example.io/still-optional',
      'schema': {
        '$id': 'https://example.io/optional',
        'properties': { 'tag': { 'type': 'string' } },
        'type': 'object'
      }
    },
    {
      'assertions': (result) => {
        assert.ok(!('required' in result), 'partial then required — partial removes required');

        const restored = Compose.required(result, 'https://example.io/restored-base') as unknown as ComposeResult;

        assert.deepStrictEqual(
          [...restored.required].sort((left, right) => {
            return left.localeCompare(right);
          }),
          [
            'age',
            'email',
            'name'
          ],
          'partial then required — all restored'
        );
      },
      'name': 'partial then required restores all properties as required',
      'newId': 'https://example.io/partial-base',
      'schema': BaseSchema
    }
  ];

  void describe('Compose.partial() edge cases', () => {
    for (const scenario of partialScenarios) {
      void it(scenario.name, () => {
        const result = Compose.partial(
          scenario.schema as never,
          scenario.newId
        ) as unknown as ComposeResult;

        scenario.assertions(result);
      });
    }
  });

  // ---------------------------------------------------------------------------
  // intersection
  // ---------------------------------------------------------------------------

  type IntersectionResult = Record<string, unknown> & {
    '$id': string;
    'allOf': Array<Record<string, unknown>>;
  };

  interface IntersectionScenario {
    'assertions': (result: IntersectionResult) => void;
    'name': string;
    'newId': string;
    'schemas': ReadonlyArray<Record<string, unknown>>;
  }

  const intersectionScenarios: IntersectionScenario[] = [
    {
      'assertions': (result) => {
        assert.strictEqual(result.$id, 'https://example.io/no-overlap', 'no overlap — $id');
        assert.strictEqual(result.allOf.length, 2, 'no overlap — allOf length');
        assert.deepStrictEqual(result.allOf[0], {
          '$id': 'https://example.io/a',
          'properties': { 'foo': { 'type': 'string' } },
          'type': 'object'
        }, 'no overlap — first schema');
        assert.deepStrictEqual(result.allOf[1], {
          '$id': 'https://example.io/b',
          'properties': { 'bar': { 'type': 'number' } },
          'type': 'object'
        }, 'no overlap — second schema');
      },
      'name': 'produces allOf with both schemas when properties do not overlap',
      'newId': 'https://example.io/no-overlap',
      'schemas': [
        {
          '$id': 'https://example.io/a',
          'properties': { 'foo': { 'type': 'string' } },
          'type': 'object'
        },
        {
          '$id': 'https://example.io/b',
          'properties': { 'bar': { 'type': 'number' } },
          'type': 'object'
        }
      ]
    },
    {
      'assertions': (result) => {
        assert.strictEqual(result.$id, 'https://example.io/empty-allof', 'edge: empty allOf — $id');
        assert.strictEqual(result.allOf.length, 0, 'edge: empty allOf — allOf is empty');
      },
      'name': 'edge: intersection with empty schemas array produces empty allOf',
      'newId': 'https://example.io/empty-allof',
      'schemas': []
    },
    {
      'assertions': (result) => {
        assert.strictEqual(result.$id, 'https://example.io/conflicting', 'conflicting types — $id');
        assert.strictEqual(result.allOf.length, 2, 'conflicting types — allOf length');
        assert.strictEqual(
          (result.allOf[0]).type,
          'string',
          'conflicting types — first type'
        );
        assert.strictEqual(
          (result.allOf[1]).type,
          'number',
          'conflicting types — second type'
        );
      },
      'name': 'produces unsatisfiable allOf when types conflict',
      'newId': 'https://example.io/conflicting',
      'schemas': [
        {
          '$id': 'https://example.io/str',
          'type': 'string'
        },
        {
          '$id': 'https://example.io/num',
          'type': 'number'
        }
      ]
    }
  ];

  void describe('Compose.intersection() edge cases', () => {
    for (const scenario of intersectionScenarios) {
      void it(scenario.name, () => {
        const result = Compose.intersection(
          scenario.schemas as unknown as readonly never[],
          scenario.newId
        ) as unknown as IntersectionResult;

        scenario.assertions(result);
      });
    }
  });

  // ---------------------------------------------------------------------------
  // discriminatedUnion
  // ---------------------------------------------------------------------------

  type DiscriminatedUnionResult = Record<string, unknown> & {
    '$id': string;
    'discriminator': Record<string, unknown>;
    'oneOf': Array<Record<string, unknown>>;
  };

  interface DiscriminatedUnionScenario {
    'assertions': (result: DiscriminatedUnionResult) => void;
    'discriminator': string;
    'name': string;
    'newId': string;
    'variants': ReadonlyArray<Record<string, unknown>>;
  }

  const discriminatedUnionScenarios: DiscriminatedUnionScenario[] = [
    {
      'assertions': (result) => {
        assert.strictEqual(result.$id, 'https://example.io/single-variant', 'single variant — $id');
        assert.deepStrictEqual(result.discriminator, { 'propertyName': 'kind' }, 'single variant — discriminator');
        assert.strictEqual(result.oneOf.length, 1, 'single variant — oneOf length');
        assert.deepStrictEqual(result.oneOf[0], {
          '$id': 'https://example.io/circle',
          'properties': {
            'kind': { 'const': 'circle' },
            'radius': { 'type': 'number' }
          },
          'required': ['kind'],
          'type': 'object'
        }, 'single variant — variant content');
      },
      'discriminator': 'kind',
      'name': 'handles degenerate case with only one variant',
      'newId': 'https://example.io/single-variant',
      'variants': [{
        '$id': 'https://example.io/circle',
        'properties': {
          'kind': { 'const': 'circle' },
          'radius': { 'type': 'number' }
        },
        'required': ['kind'],
        'type': 'object'
      }]
    },
    {
      'assertions': (result) => {
        assert.strictEqual(result.$id, 'https://example.io/mixed-discriminator', 'mixed discriminator — $id');
        assert.deepStrictEqual(result.discriminator, { 'propertyName': 'tag' }, 'mixed discriminator — discriminator');
        assert.strictEqual(result.oneOf.length, 2, 'mixed discriminator — oneOf length');

        const first = result.oneOf[0];
        const second = result.oneOf[1];
        const firstProps = first.properties as Record<string, Record<string, unknown>>;
        const secondProps = second.properties as Record<string, Record<string, unknown>>;

        assert.strictEqual(firstProps.tag.type, 'string', 'mixed discriminator — first tag type');
        assert.strictEqual(secondProps.tag.type, 'number', 'mixed discriminator — second tag type');
      },
      'discriminator': 'tag',
      'name': 'accepts variants where discriminator property has different types',
      'newId': 'https://example.io/mixed-discriminator',
      'variants': [
        {
          '$id': 'https://example.io/v-string',
          'properties': { 'tag': { 'type': 'string' } },
          'type': 'object'
        },
        {
          '$id': 'https://example.io/v-number',
          'properties': { 'tag': { 'type': 'number' } },
          'type': 'object'
        }
      ]
    }
  ];

  void describe('Compose.discriminatedUnion() edge cases', () => {
    for (const scenario of discriminatedUnionScenarios) {
      void it(scenario.name, () => {
        const result = Compose.discriminatedUnion(
          scenario.discriminator,
          scenario.variants as unknown as readonly never[],
          scenario.newId
        ) as unknown as DiscriminatedUnionResult;

        scenario.assertions(result);
      });
    }
  });
}

// ===========================================================================
// Source: composeEquivalent.test.ts
// ===========================================================================
{
  const IsbnSchema = {
    '$id': 'urn:bookstore:Isbn',
    'pattern': '^\\d{13}$',
    'type': 'string'
  } as const;

  void describe('Compose.equivalent()', () => {
    void it('emits $id and $ref, no structural duplication', () => {
      const result = Compose.equivalent(IsbnSchema, { '$id': 'urn:bookstore:PrimaryIsbn' });

      assert.strictEqual(result.$id, 'urn:bookstore:PrimaryIsbn');
      assert.strictEqual(result.$ref, 'urn:bookstore:Isbn');
      assert.ok(!('type' in result));
      assert.ok(!('pattern' in result));
    });

    void it('carries optional metadata fields', () => {
      const result = Compose.equivalent(IsbnSchema, {
        '$id': 'urn:bookstore:PrimaryIsbn',
        'description': 'Primary ISBN for catalog lookup',
        'examples': ['9780306406157'],
        'title': 'Primary ISBN'
      });

      assert.strictEqual(result.description, 'Primary ISBN for catalog lookup');
      assert.strictEqual(result.title, 'Primary ISBN');
      assert.deepStrictEqual(result.examples, ['9780306406157']);
    });

    void it('two registered equivalent schemas validate the same data', () => {
      const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });

      registry.register(IsbnSchema as unknown as Record<string, unknown>);

      const PrimaryIsbn = Compose.equivalent(IsbnSchema, {
        '$id': 'urn:bookstore:PrimaryIsbn',
        'description': 'Primary ISBN'
      });

      registry.register(PrimaryIsbn as unknown as Record<string, unknown>);

      const validIsbn = '9780306406157';
      const invalidIsbn = 'not-an-isbn';

      assert.ok(registry.validate(IsbnSchema.$id, validIsbn).ok);
      assert.ok(registry.validate('urn:bookstore:PrimaryIsbn', validIsbn).ok);
      assert.ok(registry.validate(IsbnSchema.$id, invalidIsbn).length > 0);
      assert.ok(registry.validate('urn:bookstore:PrimaryIsbn', invalidIsbn).length > 0);
    });

    void it('OWL projection emits equivalentClass for equivalent schemas', async () => {
      const { SchemaGraph } = await import('../../src/modules/graph/SchemaGraph.js');
      const { projectOwlGraph } = await import('../../src/modules/rdf/OwlProjection.js');
      const { OWL } = await import('../../src/constants/IRI.js');

      const PrimaryIsbn = Compose.equivalent(IsbnSchema, { '$id': 'urn:bookstore:PrimaryIsbn' });

      const graph = new SchemaGraph(PrimaryIsbn as unknown as Record<string, unknown>);
      const quads = projectOwlGraph(graph);

      const equivQuad = quads.find((quad) => {
        return quad.predicate === OWL.equivalentClass;
      });

      assert.ok(equivQuad !== undefined, 'equivalentClass quad should be emitted');
      assert.ok(
        (equivQuad.subject).includes('PrimaryIsbn'),
        'subject should be PrimaryIsbn'
      );
    });

    void it('fails gracefully if no $id on source', () => {
    // TypeScript constraint enforces $id at compile time; runtime test documents behavior
      const noId = {
        'pattern': '^\\d+$',
        'type': 'string'
      } as unknown as { readonly '$id': string };
      const result = Compose.equivalent(noId, { '$id': 'urn:test:NoId' });

      assert.strictEqual(result.$ref, undefined);
    });
  });
}

// ===========================================================================
// Source: composeExtendAllOf.test.ts
// ===========================================================================
{
  const PersonSchema = {
    '$id': 'https://example.io/Person',
    'properties': {
      'age': { 'type': 'number' },
      'name': { 'type': 'string' }
    },
    'required': ['name'],
    'type': 'object'
  } as const;

  void describe('Compose.extend() allOf+$ref shape', () => {
    void it('emits allOf with $ref to parent as first member', () => {
      const result = Compose.extend(PersonSchema, { 'role': { 'type': 'string' } } as const, 'https://example.io/Employee') as unknown as {
        '$id': string;
        'allOf': Array<Record<string, unknown>>;
      };

      assert.ok(Array.isArray(result.allOf), 'has allOf');
      assert.strictEqual(result.allOf.length, 2, 'allOf has 2 members');
      assert.strictEqual((result.allOf[0] as { '$ref': string }).$ref, 'https://example.io/Person', '$ref to parent');
    });

    void it('additions block has type:object and new properties', () => {
      const result = Compose.extend(PersonSchema, { 'role': { 'type': 'string' } } as const, 'https://example.io/Employee') as unknown as {
        '$id': string;
        'allOf': Array<Record<string, unknown>>;
      };

      const additions = result.allOf[1];

      assert.strictEqual(additions.type, 'object');
      const props = additions.properties as Record<string, unknown>;

      assert.ok('role' in props, 'role in additions');
    });

    void it('runtime validation validates parent + child properties', () => {
      const EmployeeSchema = Compose.extend(PersonSchema, { 'role': { 'type': 'string' } } as const, 'https://example.io/Employee2');

      const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });

      registry.register(PersonSchema as unknown as Record<string, unknown>);
      registry.register(EmployeeSchema as unknown as Record<string, unknown>);

      const validEmployee = {
        'name': 'Alice',
        'role': 'engineer'
      };

      assert.ok(registry.validate('https://example.io/Employee2', validEmployee).ok);
    });

    void it('chain extend: grandchild gets all ancestor properties at runtime', () => {
      const ManagerSchema = Compose.extend(PersonSchema, { 'department': { 'type': 'string' } } as const, 'https://example.io/Manager');

      const SeniorManagerSchema = Compose.extend(ManagerSchema as unknown as Record<string, unknown> & {
        readonly '$id': string;
      }, { 'budget': { 'type': 'number' } } as const, 'https://example.io/SeniorManager');

      const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });

      registry.register(PersonSchema as unknown as Record<string, unknown>);
      registry.register(ManagerSchema as unknown as Record<string, unknown>);
      registry.register(SeniorManagerSchema as unknown as Record<string, unknown>);

      assert.ok(registry.get('https://example.io/SeniorManager') !== undefined);
    });

    void it('does not mutate the source schema', () => {
      const original = JSON.stringify(PersonSchema);

      Compose.extend(PersonSchema, { 'extra': { 'type': 'boolean' } } as const, 'https://example.io/Mutate');
      assert.strictEqual(JSON.stringify(PersonSchema), original);
    });
  });
}

