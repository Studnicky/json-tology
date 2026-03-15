/**
 * compose — partial, required, pick, omit, narrow
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { Compose } from '../../src/modules/composition/Compose.js';
import { SchemaRegistry } from '../../src/modules/registry/SchemaRegistry.js';

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

// ---------------------------------------------------------------------------
// partial
// ---------------------------------------------------------------------------

void describe('Compose.partial()', () => {
  void it('produces a schema with no required array', () => {
    const schema = Compose.partial(UserSchema, 'https://myapp.io/PartialUser');

    assert.ok(!('required' in schema));
  });

  void it('preserves all properties', () => {
    const schema = Compose.partial(UserSchema, 'https://myapp.io/PartialUser');

    assert.ok('id' in schema.properties);
    assert.ok('name' in schema.properties);
  });

  void it('new $id is set', () => {
    const schema = Compose.partial(UserSchema, 'https://myapp.io/PartialUser');

    assert.equal(schema.$id, 'https://myapp.io/PartialUser');
  });

  void it('validates: formerly required fields are now optional', () => {
    const reg = new SchemaRegistry();
    const schema = Compose.partial(UserSchema, 'https://myapp.io/PartialUser2');

    reg.register(schema);
    assert.equal(reg.validate(schema.$id, {}).length, 0);
  });
});

// ---------------------------------------------------------------------------
// required
// ---------------------------------------------------------------------------

void describe('Compose.required()', () => {
  void it('makes every property required', () => {
    const schema = Compose.required(UserSchema, 'https://myapp.io/StrictUser');

    assert.deepEqual([...schema.required].sort(), [
      'email',
      'id',
      'name',
      'role'
    ].sort());
  });

  void it('validates: all fields required', () => {
    const reg = new SchemaRegistry();
    const schema = Compose.required(UserSchema, 'https://myapp.io/StrictUser2');

    reg.register(schema);
    // Missing email and role
    const errs = reg.validate(schema.$id, {
      'id': '1',
      'name': 'Alice'
    });

    assert.ok(errs.length > 0);
    // All present
    const ok = reg.validate(schema.$id, {
      'email': 'a@b.com',
      'id': '1',
      'name': 'Alice',
      'role': 'admin'
    });

    assert.equal(ok.length, 0);
  });
});

// ---------------------------------------------------------------------------
// pick
// ---------------------------------------------------------------------------

void describe('Compose.pick()', () => {
  void it('retains only picked properties', () => {
    const schema = Compose.pick(UserSchema, [
      'id',
      'name'
    ] as const, 'https://myapp.io/UserSummary');

    assert.ok('id' in schema.properties);
    assert.ok('name' in schema.properties);
    assert.ok(!('email' in schema.properties));
  });

  void it('preserves required status of picked fields', () => {
    const schema = Compose.pick(UserSchema, [
      'id',
      'name'
    ] as const, 'https://myapp.io/UserSummary2');

    assert.deepEqual([...schema.required].sort(), [
      'id',
      'name'
    ].sort());
  });

  void it('does not include required for non-required picked fields', () => {
    const schema = Compose.pick(UserSchema, ['email'] as const, 'https://myapp.io/EmailOnly');

    assert.ok(!('required' in schema) || schema.required.length === 0);
  });

  void it('validates correctly', () => {
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
    // id missing
    assert.ok(reg.validate(schema.$id, { 'name': 'Alice' }).length > 0);
  });
});

// ---------------------------------------------------------------------------
// omit
// ---------------------------------------------------------------------------

void describe('Compose.omit()', () => {
  void it('removes omitted properties', () => {
    const schema = Compose.omit(UserSchema, [
      'email',
      'role'
    ] as const, 'https://myapp.io/PublicUser');

    assert.ok(!('email' in schema.properties));
    assert.ok(!('role' in schema.properties));
    assert.ok('id' in schema.properties);
  });

  void it('removes omitted required fields', () => {
    const schema = Compose.omit(UserSchema, ['id'] as const, 'https://myapp.io/NoId');

    assert.ok(!schema.required.includes('id'));
    assert.ok(schema.required.includes('name'));
  });

  void it('validates correctly', () => {
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
  });
});

// ---------------------------------------------------------------------------
// narrow
// ---------------------------------------------------------------------------

const _CircleSchema = {
  '$id': 'Circle',
  'properties': {
    'kind': { 'const': 'circle' },
    'radius': { 'type': 'number' }
  },
  'type': 'object'
} as const;
const _RectSchema = {
  '$id': 'Rect',
  'properties': {
    'kind': { 'const': 'rect' },
    'width': { 'type': 'number' }
  },
  'type': 'object'
} as const;

interface Circle { 'kind': 'circle';
  'radius': number }
interface Rect { 'kind': 'rect';
  'width': number }
type Shape = Circle | Rect;

void describe('Compose.narrow()', () => {
  void it('returns true when discriminant matches', () => {
    const shape: Shape = {
      'kind': 'circle',
      'radius': 5
    };
    const matched = Compose.narrow(shape, 'kind', 'circle');

    assert.equal(matched, true);
  });

  void it('returns false when discriminant does not match', () => {
    const shape: Shape = {
      'kind': 'rect',
      'width': 10
    };
    const matched = Compose.narrow(shape, 'kind', 'circle');

    assert.equal(matched, false);
  });

  void it('returns false for non-objects', () => {
    const nullResult = Compose.narrow(null, 'kind', 'circle');
    const undefinedResult = Compose.narrow(undefined, 'kind', 'circle');
    const stringResult = Compose.narrow('string', 'kind', 'circle');

    assert.equal(nullResult, false);
    assert.equal(undefinedResult, false);
    assert.equal(stringResult, false);
  });
});

// ---------------------------------------------------------------------------
// ValidationErrors — .format() and .flatten() methods
// ---------------------------------------------------------------------------

import { ValidationErrors } from '../../src/errors/ValidationErrors.js';

void describe('ValidationErrors.format()', () => {
  void it('groups errors by path', () => {
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
  });

  void it('keys root-level errors as _root', () => {
    const errs = new ValidationErrors([{
      'keyword': 'type',
      'message': 'must be object',
      'params': {},
      'path': ''
    }]);

    assert.deepEqual(errs.format()._root, ['must be object']);
  });
});

void describe('ValidationErrors.flatten()', () => {
  void it('separates field errors from form errors', () => {
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
});

void describe('ValidationErrors misc', () => {
  void it('.ok is true when empty', () => {
    assert.equal(new ValidationErrors([]).ok, true);
  });

  void it('.ok is false when errors present', () => {
    assert.equal(new ValidationErrors([{
      'keyword': 'k',
      'message': 'x',
      'params': {},
      'path': ''
    }]).ok, false);
  });

  void it('is iterable', () => {
    const items = [{
      'keyword': 'k',
      'message': 'x',
      'params': {},
      'path': '/a'
    }];
    const errs = new ValidationErrors(items);
    const collected = [...errs];

    assert.deepEqual(collected, items);
  });

  void it('.messages() returns prefixed strings', () => {
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
});
