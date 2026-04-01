/**
 * JsonLdFormatter tests — quad-to-JSON-LD conversion
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { quadsToJsonLd } from '../../src/modules/rdf/jsonLdFormatter.js';
import type { QuadInterface } from '../../src/interfaces/Quad.js';

function literal(value: unknown, datatype = 'xsd:string'): QuadInterface['object'] {
  const obj: QuadInterface['object'] = {
    'datatype': {
      'termType': 'NamedNode',
      'value': datatype
    },
    'language': '',
    'termType': 'Literal',
    'value': value
  };

  return obj;
}

function named(value: string): QuadInterface['object'] {
  const obj: QuadInterface['object'] = {
    'termType': 'NamedNode',
    'value': value
  };

  return obj;
}

void describe('quadsToJsonLd()', () => {
  void it('groups quads by subject, converts rdf:type to @type, and handles arrays', () => {
    const quads: QuadInterface[] = [
      {
        'object': literal('Person'),
        'predicate': 'rdfs:label',
        'subject': 'ex:Person'
      },
      {
        'object': literal('A person'),
        'predicate': 'rdfs:comment',
        'subject': 'ex:Person'
      },
      {
        'object': literal('Animal'),
        'predicate': 'rdfs:label',
        'subject': 'ex:Animal'
      },
      {
        'object': named('owl:Class'),
        'predicate': 'rdf:type',
        'subject': 'ex:Person'
      }
    ];
    const result = quadsToJsonLd(quads);

    assert.equal(result.length, 2);
    assert.equal(result[0]['@id'], 'ex:Person');
    assert.equal(result[0]['rdfs:comment'], 'A person');
    assert.equal(result[0]['@type'], 'owl:Class');
    assert.equal(result[0]['rdf:type'], undefined);
    assert.equal(result[1]['@id'], 'ex:Animal');

    // Multiple values for same predicate become arrays
    const multiQuads: QuadInterface[] = [
      {
        'object': literal('Person'),
        'predicate': 'rdfs:label',
        'subject': 'ex:Person'
      },
      {
        'object': literal('Human'),
        'predicate': 'rdfs:label',
        'subject': 'ex:Person'
      }
    ];
    const multiResult = quadsToJsonLd(multiQuads);

    assert.deepEqual(multiResult[0]['rdfs:label'], [
      'Person',
      'Human'
    ]);

    // Multiple rdf:type values
    const typeQuads: QuadInterface[] = [
      {
        'object': named('owl:Class'),
        'predicate': 'rdf:type',
        'subject': 'ex:Person'
      },
      {
        'object': named('rdfs:Resource'),
        'predicate': 'rdf:type',
        'subject': 'ex:Person'
      }
    ];

    assert.deepEqual(quadsToJsonLd(typeQuads)[0]['@type'], [
      'owl:Class',
      'rdfs:Resource'
    ]);

    // Empty input
    assert.deepEqual(quadsToJsonLd([]), []);
  });

  void it('inlines singly-referenced blank nodes and keeps multiply-referenced ones', () => {
    // Singly-referenced blank node → inlined
    const singleQuads: QuadInterface[] = [
      {
        'object': {
          'termType': 'BlankNode' as const,
          'value': '_:b0'
        },
        'predicate': 'ex:address',
        'subject': 'ex:Person'
      },
      {
        'object': literal('Portland'),
        'predicate': 'ex:city',
        'subject': '_:b0'
      }
    ];
    const singleResult = quadsToJsonLd(singleQuads);

    assert.equal(singleResult.length, 1);
    assert.equal(singleResult[0]['@id'], 'ex:Person');
    const address = singleResult[0]['ex:address'] as Record<string, unknown>;

    assert.equal(address['ex:city'], 'Portland');
    assert.equal(address['@id'], undefined);

    // Multiply-referenced blank node → NOT inlined
    const multiQuads: QuadInterface[] = [
      {
        'object': {
          'termType': 'BlankNode' as const,
          'value': '_:b0'
        },
        'predicate': 'ex:address',
        'subject': 'ex:Person'
      },
      {
        'object': {
          'termType': 'BlankNode' as const,
          'value': '_:b0'
        },
        'predicate': 'ex:address',
        'subject': 'ex:Company'
      },
      {
        'object': literal('Portland'),
        'predicate': 'ex:city',
        'subject': '_:b0'
      }
    ];
    const multiResult = quadsToJsonLd(multiQuads);

    assert.equal(multiResult.length, 3);
    assert.equal((multiResult[0]['ex:address'] as Record<string, unknown>)['@id'], '_:b0');
  });

  void it('handles List terms, literal types, and NamedNode references', () => {
    // List → @list
    const listQuads: QuadInterface[] = [{
      'object': {
        'items': [
          named('ex:Circle'),
          named('ex:Square')
        ],
        'termType': 'List'
      } as unknown as QuadInterface['object'],
      'predicate': 'sh:or',
      'subject': 'ex:Shape'
    }];
    // eslint-disable-next-line @typescript-eslint/naming-convention -- JSON-LD '@list' keyword
    const orValue = quadsToJsonLd(listQuads)[0]['sh:or'] as { '@list': unknown[] };

    assert.ok('@list' in orValue);
    assert.deepEqual(orValue['@list'], [
      { '@id': 'ex:Circle' },
      { '@id': 'ex:Square' }
    ]);

    // Literal types preserved
    const typeQuads: QuadInterface[] = [
      {
        'object': literal(42, 'xsd:integer'),
        'predicate': 'ex:count',
        'subject': 'ex:Item'
      },
      {
        'object': literal(true, 'xsd:boolean'),
        'predicate': 'ex:active',
        'subject': 'ex:Item'
      },
      {
        'object': literal('Widget'),
        'predicate': 'ex:name',
        'subject': 'ex:Item'
      }
    ];
    const typeResult = quadsToJsonLd(typeQuads);

    assert.equal(typeResult[0]['ex:count'], 42);
    assert.equal(typeResult[0]['ex:active'], true);
    assert.equal(typeResult[0]['ex:name'], 'Widget');

    // NamedNode → @id reference
    const refQuads: QuadInterface[] = [{
      'object': named('ex:Agent'),
      'predicate': 'rdfs:subClassOf',
      'subject': 'ex:Person'
    }];

    assert.deepEqual(quadsToJsonLd(refQuads)[0]['rdfs:subClassOf'], { '@id': 'ex:Agent' });
  });
});
