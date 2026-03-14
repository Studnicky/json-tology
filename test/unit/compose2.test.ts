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

describe('Compose.partial()', () => {
  it('produces a schema with no required array', () => {
    const s = Compose.partial(UserSchema, 'https://myapp.io/PartialUser');

    assert.ok(!('required' in s));
  });

  it('preserves all properties', () => {
    const s = Compose.partial(UserSchema, 'https://myapp.io/PartialUser');

    assert.ok('id' in s.properties);
    assert.ok('name' in s.properties);
  });

  it('new $id is set', () => {
    const s = Compose.partial(UserSchema, 'https://myapp.io/PartialUser');

    assert.equal(s.$id, 'https://myapp.io/PartialUser');
  });

  it('validates: formerly required fields are now optional', () => {
    const reg = new SchemaRegistry();
    const s = Compose.partial(UserSchema, 'https://myapp.io/PartialUser2');

    reg.register(s);
    assert.equal(reg.validate(s.$id, {}).length, 0);
  });
});

// ---------------------------------------------------------------------------
// required
// ---------------------------------------------------------------------------

describe('Compose.required()', () => {
  it('makes every property required', () => {
    const s = Compose.required(UserSchema, 'https://myapp.io/StrictUser');

    assert.deepEqual([...s.required].sort(), [
      'email',
      'id',
      'name',
      'role'
    ].sort());
  });

  it('validates: all fields required', () => {
    const reg = new SchemaRegistry();
    const s = Compose.required(UserSchema, 'https://myapp.io/StrictUser2');

    reg.register(s);
    // Missing email and role
    const errs = reg.validate(s.$id, {
      'id': '1',
      'name': 'Alice'
    });

    assert.ok(errs.length > 0);
    // All present
    const ok = reg.validate(s.$id, {
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

describe('Compose.pick()', () => {
  it('retains only picked properties', () => {
    const s = Compose.pick(UserSchema, [
      'id',
      'name'
    ] as const, 'https://myapp.io/UserSummary');

    assert.ok('id' in s.properties);
    assert.ok('name' in s.properties);
    assert.ok(!('email' in s.properties));
  });

  it('preserves required status of picked fields', () => {
    const s = Compose.pick(UserSchema, [
      'id',
      'name'
    ] as const, 'https://myapp.io/UserSummary2');

    assert.deepEqual([...s.required].sort(), [
      'id',
      'name'
    ].sort());
  });

  it('does not include required for non-required picked fields', () => {
    const s = Compose.pick(UserSchema, ['email'] as const, 'https://myapp.io/EmailOnly');

    assert.ok(!('required' in s) || s.required.length === 0);
  });

  it('validates correctly', () => {
    const reg = new SchemaRegistry();
    const s = Compose.pick(UserSchema, [
      'id',
      'name'
    ] as const, 'https://myapp.io/UserSummary3');

    reg.register(s);
    assert.equal(reg.validate(s.$id, {
      'id': '1',
      'name': 'Alice'
    }).length, 0);
    assert.ok(reg.validate(s.$id, { 'name': 'Alice' }).length > 0); // id missing
  });
});

// ---------------------------------------------------------------------------
// omit
// ---------------------------------------------------------------------------

describe('Compose.omit()', () => {
  it('removes omitted properties', () => {
    const s = Compose.omit(UserSchema, [
      'email',
      'role'
    ] as const, 'https://myapp.io/PublicUser');

    assert.ok(!('email' in s.properties));
    assert.ok(!('role' in s.properties));
    assert.ok('id' in s.properties);
  });

  it('removes omitted required fields', () => {
    const s = Compose.omit(UserSchema, ['id'] as const, 'https://myapp.io/NoId');

    assert.ok(!s.required.includes('id'));
    assert.ok(s.required.includes('name'));
  });

  it('validates correctly', () => {
    const reg = new SchemaRegistry();
    const s = Compose.omit(UserSchema, [
      'email',
      'role'
    ] as const, 'https://myapp.io/PublicUser2');

    reg.register(s);
    assert.equal(reg.validate(s.$id, {
      'id': '1',
      'name': 'Alice'
    }).length, 0);
  });
});

// ---------------------------------------------------------------------------
// narrow
// ---------------------------------------------------------------------------

const CircleSchema = {
  '$id': 'Circle',
  'properties': {
    'kind': { 'const': 'circle' },
    'radius': { 'type': 'number' }
  },
  'type': 'object'
} as const;
const RectSchema = {
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

describe('Compose.narrow()', () => {
  it('returns true when discriminant matches', () => {
    const shape: Shape = {
      'kind': 'circle',
      'radius': 5
    };

    assert.equal(Compose.narrow(shape, 'kind', 'circle'), true);
  });

  it('returns false when discriminant does not match', () => {
    const shape: Shape = {
      'kind': 'rect',
      'width': 10
    };

    assert.equal(Compose.narrow(shape, 'kind', 'circle'), false);
  });

  it('returns false for non-objects', () => {
    assert.equal(Compose.narrow(null, 'kind', 'circle'), false);
    assert.equal(Compose.narrow(undefined, 'kind', 'circle'), false);
    assert.equal(Compose.narrow('string', 'kind', 'circle'), false);
  });
});

// ---------------------------------------------------------------------------
// ValidationErrors — .format() and .flatten() methods
// ---------------------------------------------------------------------------

import { ValidationErrors } from '../../src/errors/ValidationErrors.js';

describe('ValidationErrors.format()', () => {
  it('groups errors by path', () => {
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

  it('keys root-level errors as _root', () => {
    const errs = new ValidationErrors([{
      'keyword': 'type',
      'message': 'must be object',
      'params': {},
      'path': ''
    }]);

    assert.deepEqual(errs.format()._root, ['must be object']);
  });
});

describe('ValidationErrors.flatten()', () => {
  it('separates field errors from form errors', () => {
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

describe('ValidationErrors misc', () => {
  it('.ok is true when empty', () => {
    assert.equal(new ValidationErrors([]).ok, true);
  });

  it('.ok is false when errors present', () => {
    assert.equal(new ValidationErrors([{
      'keyword': 'k',
      'message': 'x',
      'params': {},
      'path': ''
    }]).ok, false);
  });

  it('is iterable', () => {
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

  it('.messages() returns prefixed strings', () => {
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
