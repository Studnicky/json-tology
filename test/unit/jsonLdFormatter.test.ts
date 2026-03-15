/**
 * JsonLdFormatter tests — quad-to-JSON-LD conversion
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { quadsToJsonLd } from '../../src/modules/rdf/JsonLdFormatter.js';
import type { QuadInterface } from '../../src/interfaces/quad.js';

void describe('quadsToJsonLd()', () => {
  void it('groups quads by subject into @id nodes', () => {
    const quads: QuadInterface[] = [
      {
        'object': {
          'datatype': {
            'termType': 'NamedNode',
            'value': 'xsd:string'
          },
          'language': '',
          'termType': 'Literal',
          'value': 'Person'
        },
        'predicate': 'rdfs:label',
        'subject': 'ex:Person'
      },
      {
        'object': {
          'datatype': {
            'termType': 'NamedNode',
            'value': 'xsd:string'
          },
          'language': '',
          'termType': 'Literal',
          'value': 'A person'
        },
        'predicate': 'rdfs:comment',
        'subject': 'ex:Person'
      },
      {
        'object': {
          'datatype': {
            'termType': 'NamedNode',
            'value': 'xsd:string'
          },
          'language': '',
          'termType': 'Literal',
          'value': 'Animal'
        },
        'predicate': 'rdfs:label',
        'subject': 'ex:Animal'
      }
    ];
    const result = quadsToJsonLd(quads);

    assert.equal(result.length, 2);
    assert.equal(result[0]['@id'], 'ex:Person');
    assert.equal(result[0]['rdfs:label'], 'Person');
    assert.equal(result[0]['rdfs:comment'], 'A person');
    assert.equal(result[1]['@id'], 'ex:Animal');
    assert.equal(result[1]['rdfs:label'], 'Animal');
  });

  void it('converts rdf:type to @type', () => {
    const quads: QuadInterface[] = [{
      'object': {
        'termType': 'NamedNode',
        'value': 'owl:Class'
      },
      'predicate': 'rdf:type',
      'subject': 'ex:Person'
    }];
    const result = quadsToJsonLd(quads);

    assert.equal(result[0]['@type'], 'owl:Class');
    assert.equal(result[0]['rdf:type'], undefined);
  });

  void it('multiple values for same predicate become arrays', () => {
    const quads: QuadInterface[] = [
      {
        'object': {
          'datatype': {
            'termType': 'NamedNode',
            'value': 'xsd:string'
          },
          'language': '',
          'termType': 'Literal',
          'value': 'Person'
        },
        'predicate': 'rdfs:label',
        'subject': 'ex:Person'
      },
      {
        'object': {
          'datatype': {
            'termType': 'NamedNode',
            'value': 'xsd:string'
          },
          'language': '',
          'termType': 'Literal',
          'value': 'Human'
        },
        'predicate': 'rdfs:label',
        'subject': 'ex:Person'
      }
    ];
    const result = quadsToJsonLd(quads);

    assert.ok(Array.isArray(result[0]['rdfs:label']));
    assert.deepEqual(result[0]['rdfs:label'], [
      'Person',
      'Human'
    ]);
  });

  void it('multiple rdf:type values become an array under @type', () => {
    const quads: QuadInterface[] = [
      {
        'object': {
          'termType': 'NamedNode',
          'value': 'owl:Class'
        },
        'predicate': 'rdf:type',
        'subject': 'ex:Person'
      },
      {
        'object': {
          'termType': 'NamedNode',
          'value': 'rdfs:Resource'
        },
        'predicate': 'rdf:type',
        'subject': 'ex:Person'
      }
    ];
    const result = quadsToJsonLd(quads);

    assert.ok(Array.isArray(result[0]['@type']));
    assert.deepEqual(result[0]['@type'], [
      'owl:Class',
      'rdfs:Resource'
    ]);
  });

  void it('inlines singly-referenced blank nodes and removes @id from inlined', () => {
    const quads: QuadInterface[] = [
      {
        'object': {
          'termType': 'BlankNode',
          'value': '_:b0'
        },
        'predicate': 'ex:address',
        'subject': 'ex:Person'
      },
      {
        'object': {
          'datatype': {
            'termType': 'NamedNode',
            'value': 'xsd:string'
          },
          'language': '',
          'termType': 'Literal',
          'value': 'Portland'
        },
        'predicate': 'ex:city',
        'subject': '_:b0'
      }
    ];
    const result = quadsToJsonLd(quads);

    // Only the top-level node remains
    assert.equal(result.length, 1);
    assert.equal(result[0]['@id'], 'ex:Person');

    // The blank node is inlined
    const address = result[0]['ex:address'] as Record<string, unknown>;

    assert.equal(address['ex:city'], 'Portland');
    // @id is removed from inlined blank nodes
    assert.equal(address['@id'], undefined);
  });

  void it('does NOT inline multiply-referenced blank nodes', () => {
    const quads: QuadInterface[] = [
      {
        'object': {
          'termType': 'BlankNode',
          'value': '_:b0'
        },
        'predicate': 'ex:address',
        'subject': 'ex:Person'
      },
      {
        'object': {
          'termType': 'BlankNode',
          'value': '_:b0'
        },
        'predicate': 'ex:address',
        'subject': 'ex:Company'
      },
      {
        'object': {
          'datatype': {
            'termType': 'NamedNode',
            'value': 'xsd:string'
          },
          'language': '',
          'termType': 'Literal',
          'value': 'Portland'
        },
        'predicate': 'ex:city',
        'subject': '_:b0'
      }
    ];
    const result = quadsToJsonLd(quads);

    // All three subjects remain as top-level nodes
    assert.equal(result.length, 3);

    // The blank node references remain as { '@id': '_:b0' }
    const personAddr = result[0]['ex:address'] as Record<string, unknown>;

    assert.equal(personAddr['@id'], '_:b0');

    const companyAddr = result[1]['ex:address'] as Record<string, unknown>;

    assert.equal(companyAddr['@id'], '_:b0');
  });

  void it('converts List terms to @list arrays', () => {
    const quads: QuadInterface[] = [{
      'object': {
        'items': [
          {
            'termType': 'NamedNode',
            'value': 'ex:Circle'
          },
          {
            'termType': 'NamedNode',
            'value': 'ex:Square'
          }
        ],
        'termType': 'List'
      },
      'predicate': 'sh:or',
      'subject': 'ex:Shape'
    }];
    const result = quadsToJsonLd(quads);
    // eslint-disable-next-line @typescript-eslint/naming-convention -- JSON-LD '@list' keyword
    const orValue = result[0]['sh:or'] as { '@list': unknown[] };

    assert.ok('@list' in orValue);
    assert.deepEqual(orValue['@list'], [
      { '@id': 'ex:Circle' },
      { '@id': 'ex:Square' }
    ]);
  });

  void it('preserves literal values as-is', () => {
    const quads: QuadInterface[] = [
      {
        'object': {
          'datatype': {
            'termType': 'NamedNode',
            'value': 'xsd:integer'
          },
          'language': '',
          'termType': 'Literal',
          'value': 42
        },
        'predicate': 'ex:count',
        'subject': 'ex:Item'
      },
      {
        'object': {
          'datatype': {
            'termType': 'NamedNode',
            'value': 'xsd:boolean'
          },
          'language': '',
          'termType': 'Literal',
          'value': true
        },
        'predicate': 'ex:active',
        'subject': 'ex:Item'
      },
      {
        'object': {
          'datatype': {
            'termType': 'NamedNode',
            'value': 'xsd:string'
          },
          'language': '',
          'termType': 'Literal',
          'value': 'Widget'
        },
        'predicate': 'ex:name',
        'subject': 'ex:Item'
      }
    ];
    const result = quadsToJsonLd(quads);

    assert.equal(result[0]['ex:count'], 42);
    assert.equal(result[0]['ex:active'], true);
    assert.equal(result[0]['ex:name'], 'Widget');
  });

  void it('handles NamedNode objects as @id references', () => {
    const quads: QuadInterface[] = [{
      'object': {
        'termType': 'NamedNode',
        'value': 'ex:Agent'
      },
      'predicate': 'rdfs:subClassOf',
      'subject': 'ex:Person'
    }];
    const result = quadsToJsonLd(quads);
    const ref = result[0]['rdfs:subClassOf'] as Record<string, unknown>;

    assert.deepEqual(ref, { '@id': 'ex:Agent' });
  });

  void it('returns empty array for no quads', () => {
    assert.deepEqual(quadsToJsonLd([]), []);
  });
});
