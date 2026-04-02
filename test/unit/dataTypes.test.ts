import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import {
  deepEqual,
  deepFreeze,
  isPlainObject,
  isRecord
} from '../../src/modules/data/DataTypes.js';
import {
  escapeSegment,
  propertyIri
} from '../../src/modules/graph/SchemaIri.js';
import {
  resolveSingleXsdType,
  resolveXsdType
} from '../../src/constants/XSD_MAPS.js';
import type { SchemaGraphSemanticsInterface } from '../../src/interfaces/SchemaGraph.js';

function semantics(schemaTypes: string[], format?: string): SchemaGraphSemanticsInterface {
  return {
    format,
    schemaTypes
  } as unknown as SchemaGraphSemanticsInterface;
}

void describe('isRecord', () => {
  void it('returns true for a plain object', () => {
    assert.equal(isRecord({ 'a': 1 }), true);
  });

  void it('returns true for an empty object', () => {
    assert.equal(isRecord({}), true);
  });

  void it('returns false for null', () => {
    assert.equal(isRecord(null), false);
  });

  void it('returns false for an array', () => {
    assert.equal(isRecord([
      1,
      2
    ]), false);
  });

  void it('returns false for a string', () => {
    assert.equal(isRecord('hello'), false);
  });

  void it('returns false for undefined', () => {
    assert.equal(isRecord(), false);
  });
});

void describe('isPlainObject', () => {
  void it('returns true for an empty object literal', () => {
    assert.equal(isPlainObject({}), true);
  });

  void it('returns true for an object with properties', () => {
    assert.equal(isPlainObject({ 'x': 1 }), true);
  });

  void it('returns true for Object.create(null)', () => {
    assert.equal(isPlainObject(Object.create(null)), true);
  });

  void it('returns false for an array', () => {
    assert.equal(isPlainObject([
      1,
      2
    ]), false);
  });

  void it('returns false for a Date instance', () => {
    assert.equal(isPlainObject(new Date()), false);
  });

  void it('returns false for null', () => {
    assert.equal(isPlainObject(null), false);
  });

  void it('returns false for a class instance', () => {
    class Foo {}
    assert.equal(isPlainObject(new Foo()), false);
  });
});

void describe('deepEqual', () => {
  void it('returns true for equal primitives', () => {
    assert.equal(deepEqual(42, 42), true);
    assert.equal(deepEqual('abc', 'abc'), true);
    assert.equal(deepEqual(true, true), true);
  });

  void it('returns true for identical references', () => {
    const obj = { 'a': 1 };

    assert.equal(deepEqual(obj, obj), true);
  });

  void it('returns true for structurally equal objects', () => {
    assert.equal(deepEqual({
      'a': 1,
      'b': 'x'
    }, {
      'a': 1,
      'b': 'x'
    }), true);
  });

  void it('returns false for unequal objects', () => {
    assert.equal(deepEqual({ 'a': 1 }, { 'a': 2 }), false);
  });

  void it('returns false for objects with different keys', () => {
    assert.equal(deepEqual({ 'a': 1 }, { 'b': 1 }), false);
  });

  void it('returns true for equal arrays', () => {
    assert.equal(deepEqual([
      1,
      2,
      3
    ], [
      1,
      2,
      3
    ]), true);
  });

  void it('returns false for arrays of different length', () => {
    assert.equal(deepEqual([
      1,
      2
    ], [
      1,
      2,
      3
    ]), false);
  });

  void it('handles nested equality', () => {
    const left = {
      'a': {
        'b': [
          1,
          { 'c': 2 }
        ]
      }
    };
    const right = {
      'a': {
        'b': [
          1,
          { 'c': 2 }
        ]
      }
    };

    assert.equal(deepEqual(left, right), true);
  });

  void it('returns false when one side is null', () => {
    assert.equal(deepEqual(null, { 'a': 1 }), false);
    assert.equal(deepEqual({ 'a': 1 }, null), false);
  });

  void it('returns true when both sides are null', () => {
    assert.equal(deepEqual(null, null), true);
  });

  void it('returns false for different types', () => {
    assert.equal(deepEqual(1, '1'), false);
  });
});

void describe('deepFreeze', () => {
  void it('freezes the top-level object', () => {
    const obj = { 'a': 1 };

    deepFreeze(obj);
    assert.equal(Object.isFrozen(obj), true);
  });

  void it('freezes nested objects', () => {
    const obj = { 'nested': { 'value': 42 } };

    deepFreeze(obj);
    assert.equal(Object.isFrozen(obj.nested), true);
  });

  void it('freezes deeply nested structures', () => {
    const obj = { 'a': { 'b': { 'c': 3 } } };

    deepFreeze(obj);
    assert.equal(Object.isFrozen(obj.a.b), true);
  });

  void it('returns the same reference', () => {
    const obj = { 'x': 1 };
    const result = deepFreeze(obj);

    assert.equal(result, obj);
  });
});

void describe('resolveSingleXsdType', () => {
  void it('maps string to xsd:string', () => {
    assert.equal(resolveSingleXsdType('string'), 'xsd:string');
  });

  void it('maps string with date-time format to xsd:dateTime', () => {
    assert.equal(resolveSingleXsdType('string', 'date-time'), 'xsd:dateTime');
  });

  void it('maps string with uri format to xsd:anyURI', () => {
    assert.equal(resolveSingleXsdType('string', 'uri'), 'xsd:anyURI');
  });

  void it('maps string with unknown format to xsd:string', () => {
    assert.equal(resolveSingleXsdType('string', 'unknown-format'), 'xsd:string');
  });

  void it('maps number to xsd:decimal', () => {
    assert.equal(resolveSingleXsdType('number'), 'xsd:decimal');
  });

  void it('maps number with float format to xsd:float', () => {
    assert.equal(resolveSingleXsdType('number', 'float'), 'xsd:float');
  });

  void it('maps integer to xsd:integer', () => {
    assert.equal(resolveSingleXsdType('integer'), 'xsd:integer');
  });

  void it('maps integer with int32 format to xsd:int', () => {
    assert.equal(resolveSingleXsdType('integer', 'int32'), 'xsd:int');
  });

  void it('maps boolean to xsd:boolean', () => {
    assert.equal(resolveSingleXsdType('boolean'), 'xsd:boolean');
  });

  void it('returns null for object type', () => {
    assert.equal(resolveSingleXsdType('object'), null);
  });

  void it('returns null for array type', () => {
    assert.equal(resolveSingleXsdType('array'), null);
  });

  void it('returns null for unknown type', () => {
    assert.equal(resolveSingleXsdType('foobar'), null);
  });
});

void describe('resolveXsdType', () => {
  void it('resolves a single string type', () => {
    assert.equal(resolveXsdType(semantics(['string'])), 'xsd:string');
  });

  void it('resolves a single number type', () => {
    assert.equal(resolveXsdType(semantics(['number'])), 'xsd:decimal');
  });

  void it('resolves string with format', () => {
    assert.equal(resolveXsdType(semantics(['string'], 'date')), 'xsd:date');
  });

  void it('returns owl:Nothing for null-only type', () => {
    assert.equal(resolveXsdType(semantics(['null'])), 'owl:Nothing');
  });

  void it('filters out null and resolves remaining type', () => {
    assert.equal(resolveXsdType(semantics([
      'string',
      'null'
    ])), 'xsd:string');
  });

  void it('returns null for multiple non-null types', () => {
    assert.equal(resolveXsdType(semantics([
      'string',
      'number'
    ])), null);
  });

  void it('returns null for empty types array', () => {
    assert.equal(resolveXsdType(semantics([])), null);
  });
});

void describe('propertyIri', () => {
  void it('appends property name as fragment', () => {
    assert.equal(
      propertyIri('https://example.io/User', 'email'),
      'https://example.io/User#email'
    );
  });

  void it('handles property names with special characters', () => {
    assert.equal(
      propertyIri('https://example.io/Schema', 'my-prop'),
      'https://example.io/Schema#my-prop'
    );
  });
});

void describe('escapeSegment', () => {
  void it('encodes special characters', () => {
    assert.equal(escapeSegment('hello world'), 'hello%20world');
  });

  void it('encodes hash character', () => {
    assert.equal(escapeSegment('a#b'), 'a%23b');
  });

  void it('preserves forward slashes', () => {
    assert.equal(escapeSegment('a/b/c'), 'a/b/c');
  });

  void it('returns empty string for empty input', () => {
    assert.equal(escapeSegment(''), '');
  });

  void it('leaves alphanumeric characters unchanged', () => {
    assert.equal(escapeSegment('abc123'), 'abc123');
  });
});
