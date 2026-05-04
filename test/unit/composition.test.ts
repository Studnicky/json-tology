/**
 * Schema Composition Tests — extend, intersection, discriminatedUnion,
 * partial, required, pick, omit, narrow, getDefaults, ValidationErrors
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { BaseError } from '../../src/errors/BaseError.js';
import { InstantiationError } from '../../src/errors/InstantiationError.js';
import { Compose } from '../../src/modules/composition/Compose.js';
import { Result } from '../../src/modules/data/Result.js';
import { SchemaRegistry } from '../../src/modules/registry/SchemaRegistry.js';
import { ValidationErrors } from '../../src/errors/ValidationErrors.js';
import type { ValidationErrorType } from '../../src/types/Validation.js';

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
        const reg = new SchemaRegistry();
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
        const reg = new SchemaRegistry();
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
        const reg = new SchemaRegistry();
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
        const reg = new SchemaRegistry();
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
        const reg = new SchemaRegistry();
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
