import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
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

void describe('resolveSingleXsdType', () => {
  void it('maps string to xsd:string', () => {
    assert.equal(resolveSingleXsdType('string'), 'xsd:string');
  });

  void it('maps string with date-time format to xsd:dateTime', () => {
    assert.equal(resolveSingleXsdType('string', { 'format': 'date-time' }), 'xsd:dateTime');
  });

  void it('maps string with uri format to xsd:anyURI', () => {
    assert.equal(resolveSingleXsdType('string', { 'format': 'uri' }), 'xsd:anyURI');
  });

  void it('maps string with unknown format to xsd:string', () => {
    assert.equal(resolveSingleXsdType('string', { 'format': 'unknown-format' }), 'xsd:string');
  });

  void it('maps number to xsd:decimal', () => {
    assert.equal(resolveSingleXsdType('number'), 'xsd:decimal');
  });

  void it('maps number with float format to xsd:float', () => {
    assert.equal(resolveSingleXsdType('number', { 'format': 'float' }), 'xsd:float');
  });

  void it('maps integer to xsd:integer', () => {
    assert.equal(resolveSingleXsdType('integer'), 'xsd:integer');
  });

  void it('maps integer with int32 format to xsd:int', () => {
    assert.equal(resolveSingleXsdType('integer', { 'format': 'int32' }), 'xsd:int');
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
