/**
 * compose — partial, required, pick, omit, narrow
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Compose } from '../../src/modules/composition/Compose.js';
import { SchemaRegistry } from '../../src/modules/registry/SchemaRegistry.js';

const UserSchema = {
  $id: 'https://myapp.io/User',
  type: 'object',
  properties: {
    id:    { type: 'string' },
    name:  { type: 'string' },
    email: { type: 'string' },
    role:  { type: 'string', default: 'user' },
  },
  required: ['id', 'name'],
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
    assert.deepEqual([...s.required].sort(), ['email', 'id', 'name', 'role'].sort());
  });

  it('validates: all fields required', () => {
    const reg = new SchemaRegistry();
    const s = Compose.required(UserSchema, 'https://myapp.io/StrictUser2');
    reg.register(s);
    // Missing email and role
    const errs = reg.validate(s.$id, { id: '1', name: 'Alice' });
    assert.ok(errs.length > 0);
    // All present
    const ok = reg.validate(s.$id, { id: '1', name: 'Alice', email: 'a@b.com', role: 'admin' });
    assert.equal(ok.length, 0);
  });
});

// ---------------------------------------------------------------------------
// pick
// ---------------------------------------------------------------------------

describe('Compose.pick()', () => {
  it('retains only picked properties', () => {
    const s = Compose.pick(UserSchema, ['id', 'name'] as const, 'https://myapp.io/UserSummary');
    assert.ok('id' in s.properties);
    assert.ok('name' in s.properties);
    assert.ok(!('email' in s.properties));
  });

  it('preserves required status of picked fields', () => {
    const s = Compose.pick(UserSchema, ['id', 'name'] as const, 'https://myapp.io/UserSummary2');
    assert.deepEqual([...s.required].sort(), ['id', 'name'].sort());
  });

  it('does not include required for non-required picked fields', () => {
    const s = Compose.pick(UserSchema, ['email'] as const, 'https://myapp.io/EmailOnly');
    assert.ok(!('required' in s) || (s as any).required.length === 0);
  });

  it('validates correctly', () => {
    const reg = new SchemaRegistry();
    const s = Compose.pick(UserSchema, ['id', 'name'] as const, 'https://myapp.io/UserSummary3');
    reg.register(s);
    assert.equal(reg.validate(s.$id, { id: '1', name: 'Alice' }).length, 0);
    assert.ok(reg.validate(s.$id, { name: 'Alice' }).length > 0); // id missing
  });
});

// ---------------------------------------------------------------------------
// omit
// ---------------------------------------------------------------------------

describe('Compose.omit()', () => {
  it('removes omitted properties', () => {
    const s = Compose.omit(UserSchema, ['email', 'role'] as const, 'https://myapp.io/PublicUser');
    assert.ok(!('email' in s.properties));
    assert.ok(!('role' in s.properties));
    assert.ok('id' in s.properties);
  });

  it('removes omitted required fields', () => {
    const s = Compose.omit(UserSchema, ['id'] as const, 'https://myapp.io/NoId');
    assert.ok(!(s as any).required?.includes('id'));
    assert.ok((s as any).required?.includes('name'));
  });

  it('validates correctly', () => {
    const reg = new SchemaRegistry();
    const s = Compose.omit(UserSchema, ['email', 'role'] as const, 'https://myapp.io/PublicUser2');
    reg.register(s);
    assert.equal(reg.validate(s.$id, { id: '1', name: 'Alice' }).length, 0);
  });
});

// ---------------------------------------------------------------------------
// narrow
// ---------------------------------------------------------------------------

const CircleSchema = { $id: 'Circle', type: 'object', properties: { kind: { const: 'circle' }, radius: { type: 'number' } } } as const;
const RectSchema   = { $id: 'Rect',   type: 'object', properties: { kind: { const: 'rect'   }, width:  { type: 'number' } } } as const;

type Circle = { kind: 'circle'; radius: number };
type Rect   = { kind: 'rect';   width: number };
type Shape  = Circle | Rect;

describe('Compose.narrow()', () => {
  it('returns true when discriminant matches', () => {
    const shape: Shape = { kind: 'circle', radius: 5 };
    assert.equal(Compose.narrow(shape, 'kind', 'circle'), true);
  });

  it('returns false when discriminant does not match', () => {
    const shape: Shape = { kind: 'rect', width: 10 };
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
      { path: '/name', message: 'must be string', keyword: 'type', params: {} },
      { path: '/name', message: 'min length', keyword: 'minLength', params: {} },
      { path: '/email', message: 'invalid format', keyword: 'format', params: {} },
    ]);
    const fmt = errs.format();
    assert.deepEqual(fmt['/name'], ['must be string', 'min length']);
    assert.deepEqual(fmt['/email'], ['invalid format']);
  });

  it('keys root-level errors as _root', () => {
    const errs = new ValidationErrors([
      { path: '', message: 'must be object', keyword: 'type', params: {} },
    ]);
    assert.deepEqual(errs.format()['_root'], ['must be object']);
  });
});

describe('ValidationErrors.flatten()', () => {
  it('separates field errors from form errors', () => {
    const errs = new ValidationErrors([
      { path: '/name', message: 'must be string', keyword: 'type', params: {} },
      { path: '', message: 'must be object', keyword: 'type', params: {} },
    ]);
    const { fieldErrors, formErrors } = errs.flatten();
    assert.deepEqual(fieldErrors['/name'], ['must be string']);
    assert.deepEqual(formErrors, ['must be object']);
  });
});

describe('ValidationErrors misc', () => {
  it('.ok is true when empty', () => {
    assert.equal(new ValidationErrors([]).ok, true);
  });

  it('.ok is false when errors present', () => {
    assert.equal(new ValidationErrors([{ path: '', message: 'x', keyword: 'k', params: {} }]).ok, false);
  });

  it('is iterable', () => {
    const items = [{ path: '/a', message: 'x', keyword: 'k', params: {} }];
    const errs = new ValidationErrors(items);
    const collected = [...errs];
    assert.deepEqual(collected, items);
  });

  it('.messages() returns prefixed strings', () => {
    const errs = new ValidationErrors([
      { path: '/name', message: 'bad', keyword: 'type', params: {} },
      { path: '',      message: 'root error', keyword: 'type', params: {} },
    ]);
    assert.deepEqual(errs.messages(), ['/name: bad', 'root: root error']);
  });
});
