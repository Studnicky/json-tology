import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { fromRdfQuad } from '../../src/modules/rdf/Lift.js';
import type { RdfJsQuadInterface } from '../../src/interfaces/RdfJsQuad.js';

void describe('fromRdfQuad', () => {
  void it('converts named node subject + predicate + named node object', () => {
    const quad: RdfJsQuadInterface = {
      'object': {
        'termType': 'NamedNode',
        'value': 'http://www.w3.org/2002/07/owl#Class'
      },
      'predicate': { 'value': 'http://www.w3.org/2000/01/rdf-schema#subClassOf' },
      'subject': { 'value': 'http://example.com/User' }
    };

    const result = fromRdfQuad(quad);

    assert.equal(result.subject, 'http://example.com/User');
    assert.equal(result.predicate, 'http://www.w3.org/2000/01/rdf-schema#subClassOf');
    assert.equal(result.object.termType, 'NamedNode');
    assert.equal(result.object.value, 'http://www.w3.org/2002/07/owl#Class');
  });

  void it('normalizes XSD datatype prefix on literal objects', () => {
    const quad: RdfJsQuadInterface = {
      'object': {
        'datatype': { 'value': 'http://www.w3.org/2001/XMLSchema#string' },
        'language': '',
        'termType': 'Literal',
        'value': 'Alice'
      },
      'predicate': { 'value': 'http://example.com/User#name' },
      'subject': { 'value': 'http://example.com/user/1' }
    };

    const result = fromRdfQuad(quad);

    assert.equal(result.object.termType, 'Literal');

    const literal = result.object as { 'datatype': { 'value': string };
      'termType': 'Literal';
      'value': unknown };

    assert.equal(literal.datatype.value, 'xsd:string');
    assert.equal(literal.value, 'Alice');
  });

  void it('normalizes full rdf:type IRI to prefixed form', () => {
    const quad: RdfJsQuadInterface = {
      'object': {
        'termType': 'NamedNode',
        'value': 'http://www.w3.org/2002/07/owl#Class'
      },
      'predicate': { 'value': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' },
      'subject': { 'value': 'http://example.com/User' }
    };

    const result = fromRdfQuad(quad);

    assert.equal(result.predicate, 'rdf:type');
  });

  void it('converts blank node object with correct termType', () => {
    const quad: RdfJsQuadInterface = {
      'object': {
        'termType': 'BlankNode',
        'value': '_:b0'
      },
      'predicate': { 'value': 'http://example.com/User#address' },
      'subject': { 'value': 'http://example.com/user/1' }
    };

    const result = fromRdfQuad(quad);

    assert.equal(result.object.termType, 'BlankNode');
    assert.equal(result.object.value, '_:b0');
  });

  void it('coerces xsd:integer literal value to number', () => {
    const quad: RdfJsQuadInterface = {
      'object': {
        'datatype': { 'value': 'http://www.w3.org/2001/XMLSchema#integer' },
        'termType': 'Literal',
        'value': '42'
      },
      'predicate': { 'value': 'http://example.com/User#age' },
      'subject': { 'value': 'http://example.com/user/1' }
    };

    const result = fromRdfQuad(quad);

    assert.equal(result.object.termType, 'Literal');

    const literal = result.object as { 'datatype': { 'value': string };
      'termType': 'Literal';
      'value': unknown };

    assert.equal(literal.value, 42);
    assert.equal(literal.datatype.value, 'xsd:integer');
  });

  void it('coerces xsd:boolean literal value to boolean', () => {
    const quad: RdfJsQuadInterface = {
      'object': {
        'datatype': { 'value': 'http://www.w3.org/2001/XMLSchema#boolean' },
        'termType': 'Literal',
        'value': 'true'
      },
      'predicate': { 'value': 'http://example.com/User#active' },
      'subject': { 'value': 'http://example.com/user/1' }
    };

    const result = fromRdfQuad(quad);

    const literal = result.object as { 'value': unknown };

    assert.equal(literal.value, true);
  });

  void it('preserves language tag on literal objects', () => {
    const quad: RdfJsQuadInterface = {
      'object': {
        'datatype': { 'value': 'http://www.w3.org/2001/XMLSchema#string' },
        'language': 'en',
        'termType': 'Literal',
        'value': 'Hello'
      },
      'predicate': { 'value': 'http://example.com/User#greeting' },
      'subject': { 'value': 'http://example.com/user/1' }
    };

    const result = fromRdfQuad(quad);

    const literal = result.object as { 'language': string;
      'termType': 'Literal' };

    assert.equal(literal.language, 'en');
  });
});
