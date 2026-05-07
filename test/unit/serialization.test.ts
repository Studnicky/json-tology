// Merged from: jsonLdFormatter.test.ts, projectionIndex.test.ts, serializerUtils.test.ts, tboxToshacl.test.ts, dump.test.ts
// Phase-1 mechanical consolidation per .audits/test-consolidation-2026-05.md

import assert from 'node:assert/strict';
// QuadInterface is the canonical RDF triple shape; surfaced via toQuads but type-import is internal here.
import type { QuadInterface } from '../../src/interfaces/Quad.js';
// RelationStructure/SchemaGraphRelationInterface are graph-internal shapes used by projection tests.
import type { RelationStructure } from '../../src/types/SchemaGraph.js';
import type { SchemaGraphRelationInterface } from '../../src/interfaces/SchemaGraph.js';
// ProjectionIndex helpers (buildIndex, isListStructure, isRestrictionStructure, relationTargetId) are projection internals.
import {
  buildIndex,
  isListStructure,
  isRestrictionStructure,
  relationTargetId
} from '../../src/modules/rdf/ProjectionIndex.js';
import {
  describe, it
} from 'node:test';
// SerializerUtils ensureArray/normalizeArrays are JSON-LD post-processing internals not surfaced by the public API.
import {
  ensureArray, normalizeArrays
} from '../../src/modules/ontology/SerializerUtils.js';
import {
  JsonTology, Transform
} from '../../src/index.js';
import { bookstoreEntities as entities } from '../../examples/docs/bookstore/index.js';
// quadsToJsonLd is a low-level JSON-LD formatter used by serializers; not surfaced by the public API.
import { quadsToJsonLd } from '../../src/modules/rdf/JsonLdFormatter.js';

// ===========================================================================
// Source: jsonLdFormatter.test.ts
// ===========================================================================
{
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
}

// ===========================================================================
// Source: projectionIndex.test.ts
// ===========================================================================
{
  function makeRelation(
    sourceId: string,
    predicate: string,
    target: string | { 'id': string;
      'pointer': string;
      'schema': Record<string, unknown> }
  ): SchemaGraphRelationInterface {
    return {
      'predicate': predicate,
      'source': {
        'id': sourceId,
        'pointer': '',
        'schema': {}
      },
      'target': target
    };
  }

  void describe('buildIndex', () => {
    void it('returns empty map for empty relations array', () => {
      const index = buildIndex([]);

      assert.equal(index.size, 0);
    });

    void it('groups relations by source ID', () => {
      const relations = [
        makeRelation('http://example.com/User', 'rdfs:label', 'User'),
        makeRelation('http://example.com/User', 'rdfs:comment', 'A user class'),
        makeRelation('http://example.com/Order', 'rdfs:label', 'Order')
      ];

      const index = buildIndex(relations);

      assert.equal(index.size, 2);
      assert.equal(index.get('http://example.com/User')?.all.length, 2);
      assert.equal(index.get('http://example.com/Order')?.all.length, 1);
    });

    void it('separates relations by predicate', () => {
      const relations = [
        makeRelation('http://example.com/User', 'rdfs:label', 'User'),
        makeRelation('http://example.com/User', 'rdfs:comment', 'A user class'),
        makeRelation('http://example.com/User', 'rdfs:label', 'UserAlias')
      ];

      const index = buildIndex(relations);
      const entry = index.get('http://example.com/User');

      assert.equal(entry?.byPredicate.get('rdfs:label')?.length, 2);
      assert.equal(entry.byPredicate.get('rdfs:comment')?.length, 1);
    });

    void it('extracts rdf:type relations into types array', () => {
      const relations = [
        makeRelation('http://example.com/User', 'rdf:type', 'owl:Class'),
        makeRelation('http://example.com/User', 'rdfs:label', 'User'),
        makeRelation('http://example.com/User', 'rdf:type', 'rdfs:Resource')
      ];

      const index = buildIndex(relations);
      const entry = index.get('http://example.com/User');

      assert.deepEqual(entry?.types, [
        'owl:Class',
        'rdfs:Resource'
      ]);
    });
  });

  void describe('relationTargetId', () => {
    void it('returns string target directly', () => {
      const relation = makeRelation('http://example.com/User', 'rdfs:label', 'User');

      assert.equal(relationTargetId(relation), 'User');
    });

    void it('returns node id for object target', () => {
      const relation = makeRelation(
        'http://example.com/User',
        'rdf:type',
        {
          'id': 'http://example.com/Class',
          'pointer': '',
          'schema': {}
        }
      );

      assert.equal(relationTargetId(relation), 'http://example.com/Class');
    });
  });

  void describe('isRestrictionStructure', () => {
    void it('returns true for restriction kind', () => {
      const structure: RelationStructure = {
        'constraint': 'sh:maxCount',
        'kind': 'restriction',
        'onProperty': 'http://example.com/User#name',
        'value': 1
      };

      assert.equal(isRestrictionStructure(structure), true);
    });

    void it('returns false for list kind', () => {
      const structure: RelationStructure = {
        'kind': 'list',
        'members': [
          'a',
          'b'
        ]
      };

      assert.equal(isRestrictionStructure(structure), false);
    });

    void it('returns false for undefined', () => {
      assert.equal(isRestrictionStructure(), false);
    });
  });

  void describe('isListStructure', () => {
    void it('returns true for list kind', () => {
      const structure: RelationStructure = {
        'kind': 'list',
        'members': [
          'http://example.com/a',
          'http://example.com/b'
        ]
      };

      assert.equal(isListStructure(structure), true);
    });

    void it('returns false for restriction kind', () => {
      const structure: RelationStructure = {
        'constraint': 'sh:minCount',
        'kind': 'restriction',
        'onProperty': 'http://example.com/User#age',
        'value': 0
      };

      assert.equal(isListStructure(structure), false);
    });

    void it('returns false for undefined', () => {
      assert.equal(isListStructure(), false);
    });
  });
}

// ===========================================================================
// Source: serializerUtils.test.ts
// ===========================================================================
{
// ---------------------------------------------------------------------------
// ensureArray()
// ---------------------------------------------------------------------------

  void describe('ensureArray()', () => {
    void it('wraps a single value in an array', () => {
      const node: Record<string, unknown> = { 'label': 'Person' };

      ensureArray(node, 'label');
      assert.deepEqual(node.label, ['Person']);
    });

    void it('leaves an existing array unchanged', () => {
      const node: Record<string, unknown> = {
        'label': [
          'Person',
          'Human'
        ]
      };

      ensureArray(node, 'label');
      assert.deepEqual(node.label, [
        'Person',
        'Human'
      ]);
    });

    void it('no-op when key is undefined', () => {
      const node: Record<string, unknown> = { 'label': 'Person' };

      ensureArray(node, 'missing');
      assert.equal(node.missing, undefined);
      assert.equal(node.label, 'Person');
    });

    void it('handles empty object', () => {
      const node: Record<string, unknown> = {};

      ensureArray(node, 'any');
      assert.deepEqual(node, {});
    });
  });

  // ---------------------------------------------------------------------------
  // normalizeArrays()
  // ---------------------------------------------------------------------------

  void describe('normalizeArrays()', () => {
    void it('wraps value at specified key in array', () => {
      const node: Record<string, unknown> = { 'label': 'Person' };

      normalizeArrays(node, ['label']);
      assert.deepEqual(node.label, ['Person']);
    });

    void it('handles multiple keys', () => {
      const node: Record<string, unknown> = {
        'comment': 'A person',
        'label': 'Person'
      };

      normalizeArrays(node, [
        'label',
        'comment'
      ]);
      assert.deepEqual(node.label, ['Person']);
      assert.deepEqual(node.comment, ['A person']);
    });

    void it('recursively processes nested objects', () => {
      const node: Record<string, unknown> = {
        'child': { 'label': 'Nested' },
        'label': 'Root'
      };

      normalizeArrays(node, ['label']);
      assert.deepEqual(node.label, ['Root']);
      assert.deepEqual((node.child as Record<string, unknown>).label, ['Nested']);
    });

    void it('recursively processes arrays of objects', () => {
      const node: Record<string, unknown> = {
        'items': [
          { 'label': 'First' },
          { 'label': 'Second' }
        ]
      };

      normalizeArrays(node, ['label']);
      assert.deepEqual((node.items as Array<Record<string, unknown>>)[0].label, ['First']);
      assert.deepEqual((node.items as Array<Record<string, unknown>>)[1].label, ['Second']);
    });

    void it('leaves non-matching keys unchanged', () => {
      const node: Record<string, unknown> = {
        'label': 'Person',
        'name': 'Alice'
      };

      normalizeArrays(node, ['label']);
      assert.deepEqual(node.label, ['Person']);
      assert.equal(node.name, 'Alice');
    });

    void it('handles null input gracefully', () => {
      normalizeArrays(null, ['label']);
    // no throw — void function returns silently
    });

    void it('handles primitive input gracefully', () => {
      normalizeArrays('string', ['label']);
      normalizeArrays(42, ['label']);
      normalizeArrays(true, ['label']);
    // no throw — void function returns silently
    });
  });
}

// ===========================================================================
// Source: tboxToshacl.test.ts
// ===========================================================================
{
// IRIs used as discriminators
  const OWL_CLASS_IRI = 'http://www.w3.org/2002/07/owl#Class';
  const OWL_DATATYPE_PROPERTY_IRI = 'http://www.w3.org/2002/07/owl#DatatypeProperty';
  const RDFS_DOMAIN_IRI = 'http://www.w3.org/2000/01/rdf-schema#domain';
  const SH_NODE_SHAPE_IRI = 'http://www.w3.org/ns/shacl#NodeShape';
  const SH_PROPERTY_IRI = 'http://www.w3.org/ns/shacl#property';

  function hasType(nodes: unknown[], typeIRI: string): boolean {
    return nodes.some((node) => {
      if (typeof node !== 'object' || node === null) {
        return false;
      }

      const record = node as Record<string, unknown>;
      const typeValue = record['@type'];

      if (Array.isArray(typeValue)) {
        return (typeValue as string[]).includes(typeIRI);
      }

      return typeValue === typeIRI;
    });
  }

  function hasPredicate(nodes: unknown[], predicateIRI: string): boolean {
    return nodes.some((node) => {
      if (typeof node !== 'object' || node === null) {
        return false;
      }

      const record = node as Record<string, unknown>;

      return predicateIRI in record;
    });
  }

  await describe('JsonTology.toTbox()', async () => {
    await it('returns an OntologyBuilder with non-empty raw quads', () => {
      const builder = entities.toTbox();
      const raw = builder.raw();

      assert(raw.length > 0, 'toTbox() raw quads must be non-empty');
    });

    await it('raw output contains owl:Class declarations', () => {
      const builder = entities.toTbox();
      const raw = builder.raw();

      assert.equal(hasType(raw, OWL_CLASS_IRI), true);
    });

    await it('raw output contains OWL property declarations (DatatypeProperty or ObjectProperty)', () => {
      const builder = entities.toTbox();
      const raw = builder.raw();

      const hasDatatype = hasType(raw, OWL_DATATYPE_PROPERTY_IRI);
      const hasObjectProp = hasType(raw, 'http://www.w3.org/2002/07/owl#ObjectProperty');

      assert.equal(hasDatatype || hasObjectProp, true);
    });

    await it('raw output contains rdfs:domain triples', () => {
      const builder = entities.toTbox();
      const raw = builder.raw();

      assert.equal(hasPredicate(raw, RDFS_DOMAIN_IRI), true);
    });

    await it('raw output does NOT contain sh:NodeShape triples (no SHACL)', () => {
      const builder = entities.toTbox();
      const raw = builder.raw();

      assert.equal(hasType(raw, SH_NODE_SHAPE_IRI), false);
    });

    await it('raw output does NOT contain sh:property triples (no SHACL)', () => {
      const builder = entities.toTbox();
      const raw = builder.raw();

      assert.equal(hasPredicate(raw, SH_PROPERTY_IRI), false);
    });

    await it('two calls return different OntologyBuilder instances (not cached)', () => {
      const first = entities.toTbox();
      const second = entities.toTbox();

      assert.notEqual(first, second, 'toTbox() must return a fresh OntologyBuilder on each call');
    });
  });

  await describe('JsonTology.toShacl()', async () => {
    await it('returns an OntologyBuilder with non-empty SHACL quads', () => {
      const builder = entities.toShacl();
      const shaclObj = builder.shaclObject();
      const graph = shaclObj['@graph'];

      assert.equal(Array.isArray(graph), true);
      assert((graph as unknown[]).length > 0, 'toShacl() shaclObject @graph must be non-empty');
    });

    await it('SHACL output contains sh:NodeShape triples', () => {
      const builder = entities.toShacl();
      const shaclObj = builder.shaclObject();
      const graph = shaclObj['@graph'] as unknown[];

      assert.equal(hasType(graph, SH_NODE_SHAPE_IRI), true);
    });

    await it('SHACL output contains sh:property triples', () => {
      const builder = entities.toShacl();
      const shaclObj = builder.shaclObject();
      const graph = shaclObj['@graph'] as unknown[];

      assert.equal(hasPredicate(graph, SH_PROPERTY_IRI), true);
    });

    await it('raw OWL output is empty — no owl:Class triples', () => {
      const builder = entities.toShacl();
      const raw = builder.raw();

      assert.equal(hasType(raw, OWL_CLASS_IRI), false);
    });

    await it('raw OWL output is empty — no rdfs:domain triples', () => {
      const builder = entities.toShacl();
      const raw = builder.raw();

      assert.equal(hasPredicate(raw, RDFS_DOMAIN_IRI), false);
    });

    await it('two calls return different OntologyBuilder instances (not cached)', () => {
      const first = entities.toShacl();
      const second = entities.toShacl();

      assert.notEqual(first, second, 'toShacl() must return a fresh OntologyBuilder on each call');
    });
  });

  await describe('JsonTology.ontology() regression', async () => {
    await it('returns an OntologyBuilder with owl:Class in raw output', () => {
      const builder = entities.ontology();
      const raw = builder.raw();

      assert.equal(hasType(raw, OWL_CLASS_IRI), true);
    });

    await it('returns an OntologyBuilder with sh:NodeShape in SHACL output', () => {
      const builder = entities.ontology();
      const shaclObj = builder.shaclObject();
      const graph = shaclObj['@graph'] as unknown[];

      assert.equal(hasType(graph, SH_NODE_SHAPE_IRI), true);
    });

    await it('is cached — two calls return the same OntologyBuilder reference', () => {
      const first = entities.ontology();
      const second = entities.ontology();

      assert.equal(first, second, 'ontology() must return the same cached OntologyBuilder instance');
    });
  });
}

// ===========================================================================
// Source: dump.test.ts
// ===========================================================================
{
// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

  const PersonSchema = {
    '$id': 'https://example.com/Person',
    'properties': {
      'age': {
        'default': 0,
        'type': 'number'
      },
      'name': { 'type': 'string' }
    },
    'required': ['name'],
    'type': 'object'
  } as const;

  const AddressSchema = {
    '$id': 'https://example.com/Address',
    'properties': {
      'city': { 'type': 'string' },
      'zip': { 'type': 'string' }
    },
    'type': 'object'
  } as const;

  const EmployeeSchema = {
    '$id': 'https://example.com/Employee',
    'properties': {
      'address': { '$ref': 'https://example.com/Address' },
      'name': { 'type': 'string' },
      'tags': {
        'items': { 'type': 'string' },
        'type': 'array'
      }
    },
    'required': ['name'],
    'type': 'object'
  } as const;

  const DateTimeSchema = {
    '$id': 'https://example.com/DateTime',
    'format': 'date-time',
    'type': 'string'
  } as const;

  const TransformedDateSchema = Transform.create(DateTimeSchema, {
    'decode': (raw: string) => {
      return new Date(raw);
    },
    'encode': (date: Date) => {
      return date.toISOString();
    }
  });

  const EventSchema = {
    '$id': 'https://example.com/Event',
    'properties': {
      'name': { 'type': 'string' },
      'startAt': {
        '$id': 'https://example.com/DateTime',
        'format': 'date-time',
        'type': 'string'
      }
    },
    'required': [
      'name',
      'startAt'
    ],
    'type': 'object'
  } as const;

  function makeJt() {
    return JsonTology.create({
      'baseIRI': 'https://example.com',
      'schemas': [
        PersonSchema,
        AddressSchema,
        EmployeeSchema,
        TransformedDateSchema,
        EventSchema
      ] as const
    });
  }

  // ---------------------------------------------------------------------------
  // dump — basic structural copy
  // ---------------------------------------------------------------------------

  void describe('dump — plain object schema', () => {
    void it('happy: returns structurally equal copy for a plain object', () => {
      const jt = makeJt();
      const value = {
        'age': 30,
        'name': 'Alice'
      };
      const result = jt.dump(PersonSchema.$id, value);

      assert.deepEqual(result, value);
    });

    void it('happy: output is a new object (not the same reference)', () => {
      const jt = makeJt();
      const value = {
        'age': 30,
        'name': 'Alice'
      };
      const result = jt.dump(PersonSchema.$id, value);

      assert.notEqual(result, value);
    });
  });

  // ---------------------------------------------------------------------------
  // dump — exclude
  // ---------------------------------------------------------------------------

  void describe('dump — exclude option', () => {
    void it('happy: drops listed property names from output', () => {
      const jt = makeJt();
      const value = {
        'age': 30,
        'name': 'Alice'
      };
      const result = jt.dump(PersonSchema.$id, value, { 'exclude': ['age'] }) as Record<string, unknown>;

      assert.equal('age' in result, false);
      assert.equal(result.name, 'Alice');
    });

    void it('edge: exclude with unknown property name is a no-op', () => {
      const jt = makeJt();
      const value = {
        'age': 30,
        'name': 'Alice'
      };
      const result = jt.dump(PersonSchema.$id, value, { 'exclude': ['nonexistent'] });

      assert.deepEqual(result, value);
    });
  });

  // ---------------------------------------------------------------------------
  // dump — include (outranks exclude)
  // ---------------------------------------------------------------------------

  void describe('dump — include option', () => {
    void it('happy: keeps only listed properties', () => {
      const jt = makeJt();
      const value = {
        'age': 30,
        'name': 'Alice'
      };
      const result = jt.dump(PersonSchema.$id, value, { 'include': ['name'] }) as Record<string, unknown>;

      assert.equal(result.name, 'Alice');
      assert.equal('age' in result, false);
    });

    void it('happy: include takes precedence over exclude when both are set', () => {
      const jt = makeJt();
      const value = {
        'age': 30,
        'name': 'Alice'
      };
      // include says keep 'name'; exclude says drop 'name' — include wins
      const result = jt.dump(PersonSchema.$id, value, {
        'exclude': ['name'],
        'include': ['name']
      }) as Record<string, unknown>;

      assert.equal(result.name, 'Alice');
      assert.equal('age' in result, false);
    });
  });

  // ---------------------------------------------------------------------------
  // dump — excludeUnset
  // ---------------------------------------------------------------------------

  void describe('dump — excludeUnset option', () => {
    void it('happy: drops properties with undefined value', () => {
      const jt = makeJt();
      const value = {
        'age': undefined,
        'name': 'Alice'
      };
      const result = jt.dump(PersonSchema.$id, value, { 'excludeUnset': true }) as Record<string, unknown>;

      assert.equal('age' in result, false);
      assert.equal(result.name, 'Alice');
    });

    void it('edge: non-undefined values are kept when excludeUnset is true', () => {
      const jt = makeJt();
      const value = {
        'age': 0,
        'name': 'Alice'
      };
      const result = jt.dump(PersonSchema.$id, value, { 'excludeUnset': true }) as Record<string, unknown>;

      assert.equal(result.age, 0);
    });
  });

  // ---------------------------------------------------------------------------
  // dump — excludeDefaults
  // ---------------------------------------------------------------------------

  void describe('dump — excludeDefaults option', () => {
    void it('happy: drops a property whose value equals the schema default', () => {
      const jt = makeJt();
      // age default is 0
      const value = {
        'age': 0,
        'name': 'Alice'
      };
      const result = jt.dump(PersonSchema.$id, value, { 'excludeDefaults': true }) as Record<string, unknown>;

      assert.equal('age' in result, false);
      assert.equal(result.name, 'Alice');
    });

    void it('edge: non-default value is kept when excludeDefaults is true', () => {
      const jt = makeJt();
      const value = {
        'age': 25,
        'name': 'Alice'
      };
      const result = jt.dump(PersonSchema.$id, value, { 'excludeDefaults': true }) as Record<string, unknown>;

      assert.equal(result.age, 25);
    });
  });

  // ---------------------------------------------------------------------------
  // dump — Transform encoder
  // ---------------------------------------------------------------------------

  void describe('dump — Transform encoder', () => {
    void it('happy: applies Transform encode to produce wire form', () => {
      const jt = makeJt();
      const isoString = '2026-01-01T00:00:00.000Z';
      const dateValue = new Date(isoString);
      const result = jt.dump(TransformedDateSchema.$id, dateValue);

      assert.equal(result, isoString);
    });

    void it('happy: round-trip decode then dump returns original wire value', () => {
      const jt = makeJt();
      const isoString = '2026-06-15T12:00:00.000Z';
      const decoded = jt.instantiate(TransformedDateSchema.$id, isoString);
      const wire = jt.dump(TransformedDateSchema.$id, decoded);

      assert.equal(wire, isoString);
    });
  });

  // ---------------------------------------------------------------------------
  // dump — mode 'json'
  // ---------------------------------------------------------------------------

  void describe('dump — mode json', () => {
    void it('happy: converts Date leaf to ISO string', () => {
      const jt = makeJt();
      const date = new Date('2026-01-01T00:00:00.000Z');
      // dump the Date value directly (no schema transform on PersonSchema, simulate ad-hoc)
      const result = jt.dump(TransformedDateSchema.$id, date, { 'mode': 'json' });

      assert.equal(result, '2026-01-01T00:00:00.000Z');
    });

    void it('edge: plain object leaves are untouched in json mode', () => {
      const jt = makeJt();
      const value = {
        'age': 30,
        'name': 'Alice'
      };
      const result = jt.dump(PersonSchema.$id, value, { 'mode': 'json' });

      assert.deepEqual(result, value);
    });
  });

  // ---------------------------------------------------------------------------
  // dump — nested objects
  // ---------------------------------------------------------------------------

  void describe('dump — nested object properties', () => {
    void it('happy: recursively dumps nested object properties', () => {
      const jt = makeJt();
      const value = {
        'address': {
          'city': 'Portland',
          'zip': '97201'
        },
        'name': 'Alice'
      };
      const result = jt.dump(EmployeeSchema.$id, value);

      assert.deepEqual(result, value);
    });

    void it('happy: exclude applies recursively within nested objects via top-level filter', () => {
      const jt = makeJt();
      const value = {
        'address': {
          'city': 'Portland',
          'zip': '97201'
        },
        'name': 'Alice'
      };
      const result = jt.dump(EmployeeSchema.$id, value, { 'exclude': ['address'] }) as Record<string, unknown>;

      assert.equal('address' in result, false);
      assert.equal(result.name, 'Alice');
    });
  });

  // ---------------------------------------------------------------------------
  // dump — array items
  // ---------------------------------------------------------------------------

  void describe('dump — array items', () => {
    void it('happy: recursively dumps array items', () => {
      const jt = makeJt();
      const value = {
        'name': 'Alice',
        'tags': [
          'engineer',
          'ts'
        ]
      };
      const result = jt.dump(EmployeeSchema.$id, value) as Record<string, unknown>;

      assert.deepEqual(result.tags, [
        'engineer',
        'ts'
      ]);
    });
  });

  // ---------------------------------------------------------------------------
  // dumpJson
  // ---------------------------------------------------------------------------

  void describe('dumpJson', () => {
    void it('happy: returns a JSON string', () => {
      const jt = makeJt();
      const value = {
        'age': 30,
        'name': 'Alice'
      };
      const result = jt.dumpJson(PersonSchema.$id, value);

      assert.equal(typeof result, 'string');
    });

    void it('happy: JSON.parse of result equals original value', () => {
      const jt = makeJt();
      const value = {
        'age': 30,
        'name': 'Alice'
      };
      const json = jt.dumpJson(PersonSchema.$id, value);

      assert.deepEqual(JSON.parse(json), value);
    });

    void it('happy: Date values are serialized as ISO strings (round-trip via JSON.parse)', () => {
      const jt = makeJt();
      const isoString = '2026-01-01T00:00:00.000Z';
      const decoded = jt.instantiate(TransformedDateSchema.$id, isoString);
      const json = jt.dumpJson(TransformedDateSchema.$id, decoded);
      const parsed = JSON.parse(json) as string;

      assert.equal(parsed, isoString);
    });

    void it('happy: dumpJson with exclude option drops field in JSON output', () => {
      const jt = makeJt();
      const value = {
        'age': 30,
        'name': 'Alice'
      };
      const json = jt.dumpJson(PersonSchema.$id, value, { 'exclude': ['age'] });
      const parsed = JSON.parse(json) as Record<string, unknown>;

      assert.equal('age' in parsed, false);
      assert.equal(parsed.name, 'Alice');
    });

    void it('happy: schema object overload works the same as schema ID overload', () => {
      const jt = makeJt();
      const value = {
        'age': 30,
        'name': 'Alice'
      };
      const byId = jt.dumpJson(PersonSchema.$id, value);
      const bySchema = jt.dumpJson(PersonSchema, value);

      assert.equal(byId, bySchema);
    });
  });
}

