/**
 * jt:config inheritance via Compose.extend / pick / omit
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { SchemaRegistry } from '../../src/modules/registry/SchemaRegistry.js';
import { Compose } from '../../src/modules/composition/Compose.js';
import { CoercionError } from '../../src/errors/CoercionError.js';
import type { ValidationErrorType } from '../../src/types/Validation.js';

const BaseSchema = {
  '$id': 'https://ex.io/Base',
  'jt:config': {
    'extra': 'allow',
    'strict': false
  },
  'properties': {
    'name': { 'type': 'string' },
    'score': { 'type': 'number' }
  },
  'required': ['name'],
  'type': 'object'
} as const;

const ForbidExtraSchema = {
  '$id': 'https://ex.io/ForbidExtra',
  'jt:config': { 'extra': 'forbid' },
  'properties': { 'name': { 'type': 'string' } },
  'required': ['name'],
  'type': 'object'
} as const;

const AllowExtraSchema = {
  '$id': 'https://ex.io/AllowExtra',
  'jt:config': { 'extra': 'allow' },
  'properties': { 'name': { 'type': 'string' } },
  'required': ['name'],
  'type': 'object'
} as const;

void describe('jt:config inheritance', () => {
  void it('jt:config.strict applies to all fields without individual override', () => {
    const ConfigStrictSchema = {
      '$id': 'https://ex.io/ConfigStrict',
      'jt:config': { 'strict': true },
      'properties': {
        'age': { 'type': 'integer' },
        'name': { 'type': 'string' }
      },
      'required': [
        'age',
        'name'
      ],
      'type': 'object'
    } as const;

    const registry = new SchemaRegistry({ 'castTypes': true });

    registry.register(ConfigStrictSchema);

    assert.throws(() => {
      registry.coerce(ConfigStrictSchema.$id, {
        'age': '30',
        'name': 'Alice'
      });
    });
  });

  void it('jt:config.extra: allow retains unknown properties in coerce output', () => {
    const registry = new SchemaRegistry();

    registry.register(AllowExtraSchema);
    const result = registry.coerce(AllowExtraSchema.$id, {
      'extra': 'keep-me',
      'name': 'Alice'
    }) as Record<string, unknown>;

    assert.equal(result.extra, 'keep-me');
  });

  void it('jt:config.extra: forbid raises error on unknown properties', () => {
    const registry = new SchemaRegistry();

    registry.register(ForbidExtraSchema);

    assert.throws(() => {
      registry.coerce(ForbidExtraSchema.$id, {
        'name': 'Alice',
        'unexpected': 'value'
      });
    }, (error: unknown) => {
      return error instanceof CoercionError;
    });
  });

  void it('jt:config.extra: forbid allows known properties only', () => {
    const registry = new SchemaRegistry();

    registry.register(ForbidExtraSchema);
    const result = registry.coerce(ForbidExtraSchema.$id, { 'name': 'Alice' });

    assert.deepEqual(result, { 'name': 'Alice' });
  });

  void it('extend() merges jt:config — child wins per key', () => {
    const ChildSchema = Compose.extend(
      BaseSchema,
      {
        'jt:config': { 'extra': 'forbid' },
        'role': { 'type': 'string' }
      } as const,
      'https://ex.io/Child'
    ) as Record<string, unknown>;

    // jt:config is on the additions block (allOf[1]) in the allOf+$ref shape
    const allOf = ChildSchema.allOf as Array<Record<string, unknown>>;
    const config = allOf[1]['jt:config'] as Record<string, unknown>;

    assert.equal(config.extra, 'forbid');
    assert.equal(config.strict, false);
  });

  void it('extend() without child config carries parent config unchanged', () => {
    const ChildNoConfig = Compose.extend(
      BaseSchema,
      { 'role': { 'type': 'string' } } as const,
      'https://ex.io/ChildNoConfig'
    ) as Record<string, unknown>;

    // jt:config from parent is carried into the additions block (allOf[1])
    const allOf = ChildNoConfig.allOf as Array<Record<string, unknown>>;
    const config = allOf[1]['jt:config'] as Record<string, unknown>;

    assert.equal(config.extra, 'allow');
    assert.equal(config.strict, false);
  });

  void it('pick() carries jt:config from source schema', () => {
    const PickedSchema = Compose.pick(
      BaseSchema,
      ['name'] as const,
      'https://ex.io/Picked'
    ) as Record<string, unknown>;

    const config = PickedSchema['jt:config'] as Record<string, unknown>;

    assert.equal(config.extra, 'allow');
  });

  void it('omit() carries jt:config from source schema', () => {
    const OmittedSchema = Compose.omit(
      BaseSchema,
      ['score'] as const,
      'https://ex.io/Omitted'
    ) as Record<string, unknown>;

    const config = OmittedSchema['jt:config'] as Record<string, unknown>;

    assert.equal(config.extra, 'allow');
  });

  void it('extra: forbid reports EXTRA_FORBIDDEN error keyword', () => {
    const registry = new SchemaRegistry();

    registry.register(ForbidExtraSchema);
    const errs = registry.errors(ForbidExtraSchema.$id, {
      'name': 'Alice',
      'unexpected': 'value'
    });

    assert.ok(!errs.ok);

    const allErrors: ValidationErrorType[] = [];

    for (const err of errs) {
      allErrors.push(err);
    }

    assert.ok(allErrors.some((err) => {
      return err.keyword === 'EXTRA_FORBIDDEN';
    }));
  });
});
