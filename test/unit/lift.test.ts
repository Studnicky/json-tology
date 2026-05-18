import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
// Lift.fromExternalQuad converts external rdf/js-shaped quads (from n3, eyereasoner, etc.)
// into QuadInterface. The public batch fromQuads/toQuads do not surface the per-quad shape.
import { Lift } from '../../src/modules/rdf/Lift.js';

// External quad shape (from n3, eyereasoner, etc.) — term objects with .value strings
interface ExternalRdfJsQuad {
  'object': { 'datatype'?: { 'value': string };
    'language'?: string;
    'termType': string;
    'value': string };
  'predicate': { 'value': string };
  'subject': { 'value': string };
}

void describe('fromExternalQuad', { 'concurrency': true }, () => {
  // ---------------------------------------------------------------------------
  // Good / Bad / Ugly — happy path conversions
  // ---------------------------------------------------------------------------

  void it('unhappy: malformed quads — undefined or missing object fields produce safe output', () => {
    const malformedScenarios: Array<{ 'expectThrows': boolean;
      'name': string;
      'quad': ExternalRdfJsQuad }> = [
      {
        'expectThrows': false,
        'name': 'object with no termType treated as NamedNode-like',
        'quad': {
          'object': { 'value': 'http://example.com/Thing' },
          'predicate': { 'value': 'http://example.com/pred' },
          'subject': { 'value': 'http://example.com/sub' }
        }
      },
      {
        'expectThrows': false,
        'name': 'empty string values — returned as-is',
        'quad': {
          'object': {
            'termType': 'NamedNode',
            'value': ''
          },
          'predicate': { 'value': '' },
          'subject': { 'value': '' }
        }
      }
    ];

    for (const scenario of malformedScenarios) {
      if (scenario.expectThrows) {
        assert.throws(() => {
          Lift.fromExternalQuad(scenario.quad);
        }, scenario.name);
      } else {
        assert.doesNotThrow(() => {
          Lift.fromExternalQuad(scenario.quad);
        }, scenario.name);
      }
    }
  });

  void it('converts RDF terms: named nodes, literals, blank nodes, XSD coercions, language tags', () => {
    interface LiteralObj { 'datatype': { 'value': string };
      'language'?: string;
      'termType': 'Literal';
      'value': unknown }

    const scenarios: Array<{
      'check': (result: ReturnType<typeof Lift.fromExternalQuad>) => void;
      'name': string;
      'quad': ExternalRdfJsQuad;
    }> = [
      {
        'check': (result) => {
          assert.equal(result.subject.value, 'http://example.com/User', 'subject value');
          assert.equal(result.predicate.value, 'http://www.w3.org/2000/01/rdf-schema#subClassOf', 'predicate value');
          assert.equal(result.object.termType, 'NamedNode', 'object termType');
          assert.equal(result.object.value, 'http://www.w3.org/2002/07/owl#Class', 'object value');
        },
        'name': 'named node subject + predicate + named node object',
        'quad': {
          'object': {
            'termType': 'NamedNode',
            'value': 'http://www.w3.org/2002/07/owl#Class'
          },
          'predicate': { 'value': 'http://www.w3.org/2000/01/rdf-schema#subClassOf' },
          'subject': { 'value': 'http://example.com/User' }
        }
      },
      {
        'check': (result) => {
          assert.equal(result.object.termType, 'Literal', 'termType Literal');
          const literal = result.object as LiteralObj;

          assert.equal(literal.datatype.value, 'xsd:string', 'datatype normalized to xsd:string');
          assert.equal(literal.value, 'Alice', 'value preserved');
        },
        'name': 'normalizes XSD datatype prefix on literal objects (xsd:string)',
        'quad': {
          'object': {
            'datatype': { 'value': 'http://www.w3.org/2001/XMLSchema#string' },
            'language': '',
            'termType': 'Literal',
            'value': 'Alice'
          },
          'predicate': { 'value': 'http://example.com/User#name' },
          'subject': { 'value': 'http://example.com/user/1' }
        }
      },
      {
        'check': (result) => {
          assert.equal(result.predicate.value, 'rdf:type', 'full rdf:type IRI normalized to prefixed form');
        },
        'name': 'normalizes full rdf:type IRI to prefixed form',
        'quad': {
          'object': {
            'termType': 'NamedNode',
            'value': 'http://www.w3.org/2002/07/owl#Class'
          },
          'predicate': { 'value': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' },
          'subject': { 'value': 'http://example.com/User' }
        }
      },
      {
        'check': (result) => {
          assert.equal(result.object.termType, 'BlankNode', 'blank node termType');
          assert.equal(result.object.value, '_:b0', 'blank node value');
        },
        'name': 'converts blank node object with correct termType',
        'quad': {
          'object': {
            'termType': 'BlankNode',
            'value': '_:b0'
          },
          'predicate': { 'value': 'http://example.com/User#address' },
          'subject': { 'value': 'http://example.com/user/1' }
        }
      },
      {
        'check': (result) => {
          assert.equal(result.object.termType, 'Literal', 'termType Literal');
          const literal = result.object as LiteralObj;

          assert.equal(literal.value, 42, 'xsd:integer coerced to number');
          assert.equal(literal.datatype.value, 'xsd:integer', 'datatype normalized to xsd:integer');
        },
        'name': 'coerces xsd:integer literal value to number',
        'quad': {
          'object': {
            'datatype': { 'value': 'http://www.w3.org/2001/XMLSchema#integer' },
            'termType': 'Literal',
            'value': '42'
          },
          'predicate': { 'value': 'http://example.com/User#age' },
          'subject': { 'value': 'http://example.com/user/1' }
        }
      },
      {
        'check': (result) => {
          const literal = result.object as LiteralObj;

          assert.equal(literal.value, true, 'xsd:boolean coerced to boolean true');
        },
        'name': 'coerces xsd:boolean literal value to boolean',
        'quad': {
          'object': {
            'datatype': { 'value': 'http://www.w3.org/2001/XMLSchema#boolean' },
            'termType': 'Literal',
            'value': 'true'
          },
          'predicate': { 'value': 'http://example.com/User#active' },
          'subject': { 'value': 'http://example.com/user/1' }
        }
      },
      {
        'check': (result) => {
          const literal = result.object as { 'language': string;
            'termType': 'Literal' };

          assert.equal(literal.language, 'en', 'language tag preserved');
        },
        'name': 'preserves language tag on literal objects',
        'quad': {
          'object': {
            'datatype': { 'value': 'http://www.w3.org/2001/XMLSchema#string' },
            'language': 'en',
            'termType': 'Literal',
            'value': 'Hello'
          },
          'predicate': { 'value': 'http://example.com/User#greeting' },
          'subject': { 'value': 'http://example.com/user/1' }
        }
      }
    ];

    for (const scenario of scenarios) {
      const result = Lift.fromExternalQuad(scenario.quad);

      scenario.check(result);
    }
  });
});
