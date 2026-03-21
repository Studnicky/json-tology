/**
 * Schema Composition Tests — extend, intersection, discriminatedUnion,
 * partial, required, pick, omit, narrow, getDefaults, ValidationErrors
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { BaseError } from '../../src/errors/BaseError.js';
import { CoercionError } from '../../src/errors/CoercionError.js';
import { Compose } from '../../src/modules/composition/Compose.js';
import { Result } from '../../src/modules/data/Result.js';
import { SchemaRegistry } from '../../src/modules/registry/SchemaRegistry.js';
import { ValidationErrors } from '../../src/errors/ValidationErrors.js';

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
  void it('merges properties, preserves required, sets $id, and does not mutate source', () => {
    const schema = Compose.extend(
      PersonSchema,
      { 'role': { 'type': 'string' } } as const,
      'https://example.io/person-with-role'
    );

    assert.ok('name' in schema.properties);
    assert.ok('role' in schema.properties);
    assert.deepStrictEqual([...schema.required].sort(), [
      'age',
      'name'
    ]);
    assert.strictEqual(schema.$id, 'https://example.io/person-with-role');
    assert.ok(!('role' in PersonSchema.properties));
  });
});

// ---------------------------------------------------------------------------
// intersection
// ---------------------------------------------------------------------------

void describe('Compose.intersection()', () => {
  void it('wraps schemas in allOf, sets $id, and preserves constituents', () => {
    const result = Compose.intersection([
      PersonSchema,
      AddressSchema
    ], 'https://example.io/Combined');

    assert.ok('allOf' in result);
    assert.strictEqual(result.allOf.length, 2);
    assert.strictEqual(result.$id, 'https://example.io/Combined');
    assert.deepStrictEqual(result.allOf[0], PersonSchema);
    assert.deepStrictEqual(result.allOf[1], AddressSchema);

    // Non-mutation
    const before = { ...PersonSchema };

    Compose.intersection([
      PersonSchema,
      AddressSchema
    ], 'https://example.io/Combined2');
    assert.deepStrictEqual(PersonSchema.required, before.required);
  });
});

// ---------------------------------------------------------------------------
// discriminatedUnion
// ---------------------------------------------------------------------------

void describe('Compose.discriminatedUnion()', () => {
  void it('wraps variants in oneOf with discriminator and sets $id', () => {
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
  });
});

// ---------------------------------------------------------------------------
// partial
// ---------------------------------------------------------------------------

void describe('Compose.partial()', () => {
  void it('makes all fields optional and validates correctly', () => {
    const schema = Compose.partial(UserSchema, 'https://myapp.io/PartialUser');

    assert.ok(!('required' in schema));
    assert.ok('id' in schema.properties);
    assert.ok('name' in schema.properties);
    assert.equal(schema.$id, 'https://myapp.io/PartialUser');

    const reg = new SchemaRegistry();
    const schema2 = Compose.partial(UserSchema, 'https://myapp.io/PartialUser2');

    reg.register(schema2);
    assert.equal(reg.validate(schema2.$id, {}).length, 0);
  });
});

// ---------------------------------------------------------------------------
// required
// ---------------------------------------------------------------------------

void describe('Compose.required()', () => {
  void it('makes every property required and validates correctly', () => {
    const schema = Compose.required(UserSchema, 'https://myapp.io/StrictUser');

    assert.deepEqual([...schema.required].sort(), [
      'email',
      'id',
      'name',
      'role'
    ].sort());

    const reg = new SchemaRegistry();
    const schema2 = Compose.required(UserSchema, 'https://myapp.io/StrictUser2');

    reg.register(schema2);
    assert.ok(reg.validate(schema2.$id, {
      'id': '1',
      'name': 'Alice'
    }).length > 0);
    assert.equal(reg.validate(schema2.$id, {
      'email': 'a@b.com',
      'id': '1',
      'name': 'Alice',
      'role': 'admin'
    }).length, 0);
  });
});

// ---------------------------------------------------------------------------
// pick
// ---------------------------------------------------------------------------

void describe('Compose.pick()', () => {
  void it('retains only picked properties with correct required status', () => {
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

    // Non-required picked fields
    const emailOnly = Compose.pick(UserSchema, ['email'] as const, 'https://myapp.io/EmailOnly');

    assert.ok(!('required' in emailOnly) || emailOnly.required.length === 0);

    // Validates correctly
    const reg = new SchemaRegistry();
    const schema2 = Compose.pick(UserSchema, [
      'id',
      'name'
    ] as const, 'https://myapp.io/UserSummary3');

    reg.register(schema2);
    assert.equal(reg.validate(schema2.$id, {
      'id': '1',
      'name': 'Alice'
    }).length, 0);
    assert.ok(reg.validate(schema2.$id, { 'name': 'Alice' }).length > 0);
  });
});

// ---------------------------------------------------------------------------
// omit
// ---------------------------------------------------------------------------

void describe('Compose.omit()', () => {
  void it('removes omitted properties and required entries', () => {
    const schema = Compose.omit(UserSchema, [
      'email',
      'role'
    ] as const, 'https://myapp.io/PublicUser');

    assert.ok(!('email' in schema.properties));
    assert.ok(!('role' in schema.properties));
    assert.ok('id' in schema.properties);

    const noId = Compose.omit(UserSchema, ['id'] as const, 'https://myapp.io/NoId');

    assert.ok(!noId.required.includes('id'));
    assert.ok(noId.required.includes('name'));

    const reg = new SchemaRegistry();
    const schema2 = Compose.omit(UserSchema, [
      'email',
      'role'
    ] as const, 'https://myapp.io/PublicUser2');

    reg.register(schema2);
    assert.equal(reg.validate(schema2.$id, {
      'id': '1',
      'name': 'Alice'
    }).length, 0);
  });
});

// ---------------------------------------------------------------------------
// narrow
// ---------------------------------------------------------------------------

void describe('Compose.narrow()', () => {
  void it('narrows discriminated unions', () => {
    const scenarios: Array<[unknown, string, string, boolean]> = [
      [
        {
          'kind': 'circle',
          'radius': 5
        },
        'kind',
        'circle',
        true
      ],
      [
        {
          'kind': 'rect',
          'width': 10
        },
        'kind',
        'circle',
        false
      ],
      [
        null,
        'kind',
        'circle',
        false
      ],
      [
        undefined,
        'kind',
        'circle',
        false
      ],
      [
        'string',
        'kind',
        'circle',
        false
      ]
    ];

    for (const [
      value,
      key,
      expected,
      result
    ] of scenarios) {
      assert.equal(Compose.narrow(value, key, expected), result);
    }
  });
});

// ---------------------------------------------------------------------------
// getDefaults
// ---------------------------------------------------------------------------

void describe('Compose.getDefaults()', () => {
  void it('extracts defaults, recurses, and deep-clones', () => {
    const testSchema = {
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

    const defaults = Compose.getDefaults(testSchema);

    assert.equal(defaults.name, 'Alice');
    assert.equal(defaults.active, true);
    assert.equal('age' in defaults, false);

    const nested = defaults.nested as Record<string, unknown>;

    assert.equal(typeof nested, 'object');
    assert.equal(nested.count, 0);
    assert.equal('label' in nested, false);

    // Empty cases
    assert.deepEqual(Compose.getDefaults({
      'properties': { 'x': { 'type': 'string' } },
      'type': 'object'
    }), {});
    assert.deepEqual(Compose.getDefaults({ 'type': 'object' }), {});

    // Deep-clone protection
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
  void it('format() groups errors by path with _root for root-level', () => {
    const errs = new ValidationErrors([
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
    ]);
    const fmt = errs.format();

    assert.deepEqual(fmt['/name'], [
      'must be string',
      'min length'
    ]);
    assert.deepEqual(fmt['/email'], ['invalid format']);

    const rootErrs = new ValidationErrors([{
      'keyword': 'type',
      'message': 'must be object',
      'params': {},
      'path': ''
    }]);

    assert.deepEqual(rootErrs.format()._root, ['must be object']);
  });

  void it('flatten() separates field and form errors', () => {
    const errs = new ValidationErrors([
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
    ]);
    const {
      fieldErrors, formErrors
    } = errs.flatten();

    assert.deepEqual(fieldErrors['/name'], ['must be string']);
    assert.deepEqual(formErrors, ['must be object']);
  });

  void it('ok, iterable, and messages()', () => {
    assert.equal(new ValidationErrors([]).ok, true);
    assert.equal(new ValidationErrors([{
      'keyword': 'k',
      'message': 'x',
      'params': {},
      'path': ''
    }]).ok, false);

    const items = [{
      'keyword': 'k',
      'message': 'x',
      'params': {},
      'path': '/a'
    }];

    assert.deepEqual([...new ValidationErrors(items)], items);

    const errs = new ValidationErrors([
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
    ]);

    assert.deepEqual(errs.messages(), [
      '/name: bad',
      'root: root error'
    ]);
  });

  void it('fromValidatorErrors() maps external errors and handles null/empty', () => {
    // Normal mapping
    const mapped = ValidationErrors.fromValidatorErrors([
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
    ]);

    assert.equal(mapped.length, 2);
    assert.equal(mapped.items[0].path, '/name');
    assert.equal(mapped.items[0].message, 'must be string');
    // fallback when message undefined
    assert.equal(mapped.items[1].message, 'Validation failed');

    // Null/undefined/empty input → single unknown error
    assert.equal(ValidationErrors.fromValidatorErrors(null).length, 1);
    assert.equal(ValidationErrors.fromValidatorErrors(null).items[0].keyword, 'unknown');
    assert.equal(ValidationErrors.fromValidatorErrors().length, 1);
    assert.equal(ValidationErrors.fromValidatorErrors([]).length, 1);
  });
});

// ---------------------------------------------------------------------------
// Result monad
// ---------------------------------------------------------------------------

void describe('Result', () => {
  void it('pass/fail, map, orElse, and unwrap behave correctly', () => {
    // pass: success=true, data present
    const ok = Result.pass(42);

    assert.equal(ok.success, true);
    assert.equal(ok.data, 42);
    assert.equal(ok.errors, undefined);

    // fail: success=false, errors present
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

    // map: transforms success, passes failure through
    const mapped = ok.map((value) => {
      return value * 2;
    });

    assert.equal(mapped.success, true);
    assert.equal(mapped.data, 84);

    const failMapped = fail.map((value) => {
      return value * 2;
    });

    assert.equal(failMapped.success, false);
    assert.equal(failMapped.data, undefined);

    // orElse: returns data on success, fallback on failure
    assert.equal(ok.orElse(() => {
      return -1;
    }), 42);
    assert.equal(fail.orElse(() => {
      return -1;
    }), -1);

    // unwrap: returns data on success, throws CoercionError on failure
    assert.equal(ok.unwrap(), 42);
    assert.throws(
      () => {
        return fail.unwrap();
      },
      (err: unknown) => {
        return err instanceof CoercionError;
      }
    );
  });
});

// ---------------------------------------------------------------------------
// Error class toJson(), flatten(), and cause chain
// ---------------------------------------------------------------------------

void describe('Error classes', () => {
  void it('BaseError: toJson serializes with nested cause, flatten walks cause chain', () => {
    // toJson without cause
    const simple = new BaseError('TEST_CODE', 'simple message', true);
    const json = simple.toJson();

    assert.equal(json.code, 'TEST_CODE');
    assert.equal(json.message, 'simple message');
    assert.equal(json.retryable, true);
    assert.equal(json.cause, undefined);

    // toJson with BaseError cause
    const inner = new BaseError('INNER', 'inner error');
    const outer = new BaseError('OUTER', 'outer error', false, { 'cause': inner });
    const outerJson = outer.toJson();

    assert.equal(outerJson.cause.code, 'INNER');
    assert.equal(outerJson.cause.message, 'inner error');

    // toJson with plain Error cause
    const plain = new BaseError('WRAP', 'wrapped', false, { 'cause': new Error('plain') });
    const plainJson = plain.toJson();

    assert.equal(plainJson.cause.code, 'UNKNOWN');
    assert.equal(plainJson.cause.message, 'plain');

    // flatten walks chain
    const deep = new BaseError('L1', 'level 1', false, { 'cause': new BaseError('L2', 'level 2', false, { 'cause': new BaseError('L3', 'level 3') }) });
    const chain = deep.flatten();

    assert.equal(chain.length, 3);
    assert.equal(chain[0].code, 'L1');
    assert.equal(chain[1].code, 'L2');
    assert.equal(chain[2].code, 'L3');
  });

  void it('CoercionError: flatten appends validation items, toJson includes errors array', () => {
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
    const err = new CoercionError(items);

    // flatten: base entry + validation items
    const flat = err.flatten();

    // 1 base + 2 items
    assert.equal(flat.length, 3);
    assert.equal(flat[0].code, 'COERCION_FAILED');
    assert.equal(flat[1].code, 'required');
    assert.ok(flat[1].message.includes('missing name'));
    assert.equal(flat[2].code, 'type');

    // toJson: includes errors array
    const json = err.toJson();

    assert.equal(json.code, 'COERCION_FAILED');
    assert.ok('errors' in json);
    const errors = (json as Record<string, unknown>).errors as Array<Record<string, unknown>>;

    assert.equal(errors.length, 2);
    assert.equal(errors[0].keyword, 'required');
    assert.equal(errors[1].path, '/age');
  });
});
