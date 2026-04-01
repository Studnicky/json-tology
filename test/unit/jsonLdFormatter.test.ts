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

// ---------------------------------------------------------------------------
// quadsToJsonLd() — grouping, types, and arrays
// ---------------------------------------------------------------------------

void describe('quadsToJsonLd() grouping and type conversion', () => {
  const groupingScenarios: Array<{
    'check': (result: Array<Record<string, unknown>>) => void;
    'name': string;
    'quads': QuadInterface[];
  }> = [
    {
      'check': (result) => {
        assert.equal(result.length, 2);
        assert.equal(result[0]['@id'], 'ex:Person');
        assert.equal(result[0]['rdfs:comment'], 'A person');
        assert.equal(result[1]['@id'], 'ex:Animal');
      },
      'name': 'happy: groups quads by subject into separate nodes',
      'quads': [
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
        }
      ]
    },
    {
      'check': (result) => {
        assert.equal(result[0]['@type'], 'owl:Class');
        assert.equal(result[0]['rdf:type'], undefined);
      },
      'name': 'happy: converts rdf:type to @type',
      'quads': [{
        'object': named('owl:Class'),
        'predicate': 'rdf:type',
        'subject': 'ex:Person'
      }]
    },
    {
      'check': (result) => {
        assert.deepEqual(result[0]['rdfs:label'], [
          'Person',
          'Human'
        ]);
      },
      'name': 'happy: multiple values for same predicate become arrays',
      'quads': [
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
      ]
    },
    {
      'check': (result) => {
        assert.deepEqual(result[0]['@type'], [
          'owl:Class',
          'rdfs:Resource'
        ]);
      },
      'name': 'happy: multiple rdf:type values become @type array',
      'quads': [
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
      ]
    },
    {
      'check': (result) => {
        assert.deepEqual(result, []);
      },
      'name': 'edge: empty quads array produces empty result',
      'quads': []
    },
    {
      'check': (result) => {
        assert.equal(result.length, 1);
        assert.equal(result[0]['@id'], 'ex:Widget');
        assert.equal(result[0]['rdfs:label'], 'Widget');
      },
      'name': 'edge: single quad produces single node',
      'quads': [{
        'object': literal('Widget'),
        'predicate': 'rdfs:label',
        'subject': 'ex:Widget'
      }]
    },
    {
      'check': (result) => {
        assert.equal(result.length, 1);
        assert.equal(result[0]['@id'], 'ex:Person');
        assert.equal(result[0]['ex:age'], 30);
      },
      'name': 'edge: duplicate subjects with different predicates merge into one node',
      'quads': [
        {
          'object': literal('Alice'),
          'predicate': 'ex:name',
          'subject': 'ex:Person'
        },
        {
          'object': literal(30, 'xsd:integer'),
          'predicate': 'ex:age',
          'subject': 'ex:Person'
        },
        {
          'object': literal('Alice'),
          'predicate': 'ex:name',
          'subject': 'ex:Person'
        }
      ]
    }
  ];

  for (const {
    'check': check, 'name': name, 'quads': quads
  } of groupingScenarios) {
    void it(name, () => {
      const result = quadsToJsonLd(quads);

      check(result);
    });
  }
});

// ---------------------------------------------------------------------------
// quadsToJsonLd() — blank node handling
// ---------------------------------------------------------------------------

void describe('quadsToJsonLd() blank node handling', () => {
  const blankNodeScenarios: Array<{
    'check': (result: Array<Record<string, unknown>>) => void;
    'name': string;
    'quads': QuadInterface[];
  }> = [
    {
      'check': (result) => {
        assert.equal(result.length, 1);
        assert.equal(result[0]['@id'], 'ex:Person');
        const address = result[0]['ex:address'] as Record<string, unknown>;

        assert.equal(address['ex:city'], 'Portland');
        assert.equal(address['@id'], undefined);
      },
      'name': 'happy: singly-referenced blank node is inlined',
      'quads': [
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
      ]
    },
    {
      'check': (result) => {
        assert.equal(result.length, 3);
        assert.equal(
          (result[0]['ex:address'] as Record<string, unknown>)['@id'],
          '_:b0'
        );
      },
      'name': 'happy: multiply-referenced blank node is NOT inlined',
      'quads': [
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
      ]
    },
    {
      'check': (result) => {
        // multiply-referenced blank node with no own triples
        const refs = result.filter((n) => {
          return n['ex:ref'] !== undefined;
        });

        for (const node of refs) {
          assert.equal(
            (node['ex:ref'] as Record<string, unknown>)['@id'],
            '_:empty'
          );
        }
      },
      'name': 'edge: blank node with no properties still referenced by @id',
      'quads': [
        {
          'object': {
            'termType': 'BlankNode' as const,
            'value': '_:empty'
          },
          'predicate': 'ex:ref',
          'subject': 'ex:Parent'
        },
        {
          'object': {
            'termType': 'BlankNode' as const,
            'value': '_:empty'
          },
          'predicate': 'ex:ref',
          'subject': 'ex:Other'
        }
      ]
    }
  ];

  for (const {
    'check': check, 'name': name, 'quads': quads
  } of blankNodeScenarios) {
    void it(name, () => {
      const result = quadsToJsonLd(quads);

      check(result);
    });
  }
});

// ---------------------------------------------------------------------------
// quadsToJsonLd() — List terms, literal types, and NamedNode references
// ---------------------------------------------------------------------------

void describe('quadsToJsonLd() term types', () => {
  const termScenarios: Array<{
    'check': (result: Array<Record<string, unknown>>) => void;
    'name': string;
    'quads': QuadInterface[];
  }> = [
    {
      'check': (result) => {
        // eslint-disable-next-line @typescript-eslint/naming-convention -- JSON-LD '@list' keyword
        const orValue = result[0]['sh:or'] as { '@list': unknown[] };

        assert.ok('@list' in orValue);
        assert.deepEqual(orValue['@list'], [
          { '@id': 'ex:Circle' },
          { '@id': 'ex:Square' }
        ]);
      },
      'name': 'happy: List term becomes @list',
      'quads': [{
        'object': {
          'items': [
            named('ex:Circle'),
            named('ex:Square')
          ],
          'termType': 'List'
        } as unknown as QuadInterface['object'],
        'predicate': 'sh:or',
        'subject': 'ex:Shape'
      }]
    },
    {
      'check': (result) => {
        assert.equal(result[0]['ex:count'], 42);
        assert.equal(result[0]['ex:active'], true);
        assert.equal(result[0]['ex:name'], 'Widget');
      },
      'name': 'happy: literal types preserved (integer, boolean, string)',
      'quads': [
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
      ]
    },
    {
      'check': (result) => {
        assert.deepEqual(result[0]['rdfs:subClassOf'], { '@id': 'ex:Agent' });
      },
      'name': 'happy: NamedNode becomes @id reference',
      'quads': [{
        'object': named('ex:Agent'),
        'predicate': 'rdfs:subClassOf',
        'subject': 'ex:Person'
      }]
    }
  ];

  for (const {
    'check': check, 'name': name, 'quads': quads
  } of termScenarios) {
    void it(name, () => {
      const result = quadsToJsonLd(quads);

      check(result);
    });
  }
});
