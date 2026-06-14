/**
 * Regression tests for GraphEngineDefaults.synthesizeZeroValue not handling anyOf/oneOf.
 *
 * Before the fix, synthesizeZeroValueInternal only handled primitives, own
 * properties, and allOf members. A schema whose only structure was anyOf or
 * oneOf fell through to `return null`. So value.create() on a union schema
 * returned null instead of synthesizing from the first viable member.
 *
 * After the fix, anyOf and oneOf members are tried in order and the first
 * member that yields a non-null zero value is returned.
 */

import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';
import { JsonTology } from '../../src/index.js';

void describe('synthesizeZeroValue — anyOf/oneOf schemas', { 'concurrency': false }, () => {
  void it('synthesizes a zero value from the first anyOf member', () => {
    const Schema = {
      '$id': 'urn:zeroval:anyof:Shape',
      'anyOf': [
        { 'type': 'string' },
        { 'type': 'number' }
      ]
    } as const;

    // anyOf members are primitive types (no nested objects) — passes strict validation.
    const jt = JsonTology.create({
      'baseIRI': 'urn:zeroval:anyof:',
      'schemas': [Schema] as const
    });

    // value.create synthesizes a zero value — for anyOf[string, number] the
    // first viable member is string, so the result should be ''.
    const result = jt.value.create(Schema.$id);

    // Before the fix this returned null; after the fix it returns '' (string zero).
    assert.equal(result, '', 'anyOf with string first should yield empty string zero value');
  });

  void it('synthesizes a zero value from the first oneOf member', () => {
    const Schema = {
      '$id': 'urn:zeroval:oneof:Shape',
      'oneOf': [
        { 'type': 'boolean' },
        { 'type': 'string' }
      ]
    } as const;

    // oneOf members are primitive types — passes strict validation.
    const jt = JsonTology.create({
      'baseIRI': 'urn:zeroval:oneof:',
      'schemas': [Schema] as const
    });

    // First viable member is boolean → false.
    const result = jt.value.create(Schema.$id);

    assert.equal(result, false, 'oneOf with boolean first should yield false zero value');
  });

  void it('skips null-yielding anyOf members and returns the first non-null', () => {
    // The first member has no type and no properties → synthesizes null.
    // The second member has type:number → synthesizes 0.
    // After the fix, we should get 0, not null.
    const Schema = {
      '$id': 'urn:zeroval:anyof:skip:Shape',
      'anyOf': [
        { 'description': 'no type — yields null' },
        { 'type': 'number' }
      ]
    } as const;

    // anyOf members are primitive or description-only — passes strict validation.
    const jt = JsonTology.create({
      'baseIRI': 'urn:zeroval:anyof:skip:',
      'schemas': [Schema] as const
    });

    const result = jt.value.create(Schema.$id);

    assert.equal(result, 0, 'should skip null-yielding member and return first non-null (0)');
  });

  void it('synthesizes an object zero value from an anyOf object member', () => {
    // Inline object members in anyOf trigger strict-graph inline-shape warnings,
    // so use enableStrictGraph:false to allow the schema.
    const Schema = {
      '$id': 'urn:zeroval:anyof:obj:Shape',
      'anyOf': [
        {
          'properties': {
            'id': { 'type': 'string' },
            'score': { 'type': 'number' }
          },
          'required': ['id'],
          'type': 'object'
        },
        { 'type': 'null' }
      ]
    } as const;

    const jt = JsonTology.create({
      'baseIRI': 'urn:zeroval:anyof:obj:',
      'enableStrictGraph': false,
      'schemas': [Schema] as const
    });

    // First viable member is the object branch.
    const result = jt.value.create(Schema.$id);

    assert.ok(result !== null, 'should synthesize an object, not null');
    assert.equal(typeof result, 'object', 'should synthesize an object zero value');
  });
});
