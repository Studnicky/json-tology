// Merged from: jsonLdFormatter.test.ts, projectionIndex.test.ts, serializerUtils.test.ts, tboxToshacl.test.ts, dump.test.ts
// Phase-1 mechanical consolidation per .audits/test-consolidation-2026-05.md

import assert from 'node:assert/strict';
// QuadInterface is the canonical RDF triple shape; surfaced via toQuads but type-import is internal here.
import type { QuadInterface } from '../../src/interfaces/QuadInterface.js';
// QuadObjectType is the project's narrow quad-object union (IRI | blank | literal),
// matching what Terms.iri/Terms.literal return and what Terms.quad/listQuad accept.
import type { QuadObjectType } from '../../src/types/Quad.js';
// RelationStructure/SchemaGraphRelationType are graph-internal shapes used by projection tests.
import type { RelationStructure } from '../../src/types/SchemaGraph.js';
import type { SchemaGraphRelationType } from '../../src/types/SchemaGraph.js';
// ProjectionIndex helpers are projection internals.
import { ProjectionIndex } from '../../src/modules/rdf/ProjectionIndex.js';
import {
  describe, it
} from 'node:test';
// ensureArray/normalizeArrays are JSON-LD post-processing statics on BaseGraphSerializer.
import { BaseGraphSerializer } from '../../src/modules/ontology/BaseGraphSerializer.js';
import {
  JsonTology, Transform
} from '../../src/index.js';
import { Brand } from '../../src/modules/data/Brand.js';
import type { InferSchemaType } from '../../src/types/Infer.js';
import { bookstoreEntities as entities } from '../../examples/docs/bookstore/index.js';
// JsonLdFormatter is a low-level JSON-LD formatter used by serializers; not surfaced by the public API.
import { JsonLdFormatter } from '../../src/modules/rdf/JsonLdFormatter.js';
// Terms factory — produces rdf/js-compliant term objects for test quad construction.
import { Terms } from '../../src/modules/quads/Terms.js';
import { listQuad } from '../helpers/listQuad.js';
import {
  OWL, RDF, XSD
} from '../../src/constants/IRI.js';

// ===========================================================================
// Source: jsonLdFormatter.test.ts
// ===========================================================================
{
  function literal(value: unknown, datatype: string = XSD.string): QuadObjectType {
    return Terms.literal(value, { 'datatype': Terms.iri(datatype) });
  }

  function named(value: string): QuadObjectType {
    return Terms.iri(value);
  }

  function quad(subject: string, predicate: string, object: QuadObjectType): QuadInterface {
    return Terms.quad(
      subject.startsWith('_:') ? Terms.blank(subject) : Terms.iri(subject),
      Terms.iri(predicate),
      object,
      Terms.defaultGraph()
    );
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
          const r0 = result.at(0);

          if (r0 === undefined) {
            throw new Error('expected element at 0');
          }
          const r1 = result.at(1);

          if (r1 === undefined) {
            throw new Error('expected element at 1');
          }
          assert.equal(r0['@id'], 'ex:Person');
          assert.equal(r0['rdfs:comment'], 'A person');
          assert.equal(r1['@id'], 'ex:Animal');
        },
        'name': 'happy: groups quads by subject into separate nodes',
        'quads': [
          quad('ex:Person', 'rdfs:label', literal('Person')),
          quad('ex:Person', 'rdfs:comment', literal('A person')),
          quad('ex:Animal', 'rdfs:label', literal('Animal'))
        ]
      },
      {
        'check': (result) => {
          const r0 = result.at(0);

          if (r0 === undefined) {
            throw new Error('expected element at 0');
          }
          assert.equal(r0['@type'], OWL.Class);
          assert.equal(r0[RDF.type], undefined);
        },
        'name': 'happy: converts rdf:type to @type',
        'quads': [quad('ex:Person', RDF.type, named(OWL.Class))]
      },
      {
        'check': (result) => {
          const r0 = result.at(0);

          if (r0 === undefined) {
            throw new Error('expected element at 0');
          }
          assert.deepEqual(r0['rdfs:label'], [
            'Person',
            'Human'
          ]);
        },
        'name': 'happy: multiple values for same predicate become arrays',
        'quads': [
          quad('ex:Person', 'rdfs:label', literal('Person')),
          quad('ex:Person', 'rdfs:label', literal('Human'))
        ]
      },
      {
        'check': (result) => {
          const r0 = result.at(0);

          if (r0 === undefined) {
            throw new Error('expected element at 0');
          }
          assert.deepEqual(r0['@type'], [
            OWL.Class,
            'http://www.w3.org/2000/01/rdf-schema#Resource'
          ]);
        },
        'name': 'happy: multiple rdf:type values become @type array',
        'quads': [
          quad('ex:Person', RDF.type, named(OWL.Class)),
          quad('ex:Person', RDF.type, named('http://www.w3.org/2000/01/rdf-schema#Resource'))
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
          const r0 = result.at(0);

          if (r0 === undefined) {
            throw new Error('expected element at 0');
          }
          assert.equal(r0['@id'], 'ex:Widget');
          assert.equal(r0['rdfs:label'], 'Widget');
        },
        'name': 'edge: single quad produces single node',
        'quads': [quad('ex:Widget', 'rdfs:label', literal('Widget'))]
      },
      {
        'check': (result) => {
          assert.equal(result.length, 1);
          const r0 = result.at(0);

          if (r0 === undefined) {
            throw new Error('expected element at 0');
          }
          assert.equal(r0['@id'], 'ex:Person');
          assert.equal(r0['ex:age'], 30);
        },
        'name': 'edge: duplicate subjects with different predicates merge into one node',
        'quads': [
          quad('ex:Person', 'ex:name', literal('Alice')),
          quad('ex:Person', 'ex:age', literal(30, 'xsd:integer')),
          quad('ex:Person', 'ex:name', literal('Alice'))
        ]
      }
    ];

    for (const {
      'check': check, 'name': name, 'quads': quads
    } of groupingScenarios) {
      void it(name, () => {
        const result = JsonLdFormatter.fromQuads(quads);

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
          const r0 = result.at(0);

          if (r0 === undefined) {
            throw new Error('expected element at 0');
          }
          assert.equal(r0['@id'], 'ex:Person');
          const address = r0['ex:address'] as Record<string, unknown>;

          assert.equal(address['ex:city'], 'Portland');
          assert.equal(address['@id'], undefined);
        },
        'name': 'happy: singly-referenced blank node is inlined',
        'quads': [
          quad('ex:Person', 'ex:address', Terms.blank('_:b0')),
          quad('_:b0', 'ex:city', literal('Portland'))
        ]
      },
      {
        'check': (result) => {
          assert.equal(result.length, 3);
          const r0 = result.at(0);

          if (r0 === undefined) {
            throw new Error('expected element at 0');
          }
          assert.equal(
            (r0['ex:address'] as Record<string, unknown>)['@id'],
            '_:b0'
          );
        },
        'name': 'happy: multiply-referenced blank node is NOT inlined',
        'quads': [
          quad('ex:Person', 'ex:address', Terms.blank('_:b0')),
          quad('ex:Company', 'ex:address', Terms.blank('_:b0')),
          quad('_:b0', 'ex:city', literal('Portland'))
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
          quad('ex:Parent', 'ex:ref', Terms.blank('_:empty')),
          quad('ex:Other', 'ex:ref', Terms.blank('_:empty'))
        ]
      }
    ];

    for (const {
      'check': check, 'name': name, 'quads': quads
    } of blankNodeScenarios) {
      void it(name, () => {
        const result = JsonLdFormatter.fromQuads(quads);

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
          const shape = result.find((node) => {
            return node['@id'] === 'ex:Shape';
          });

          assert.ok(shape !== undefined, 'ex:Shape subject must be emitted');
          const orValue = shape['sh:or'] as { '@list': unknown[] };

          assert.deepEqual(orValue['@list'], [
            { '@id': 'ex:Circle' },
            { '@id': 'ex:Square' }
          ]);
        },
        'name': 'happy: rdf:first/rdf:rest chain becomes @list',
        'quads': listQuad(
          Terms.iri('ex:Shape'),
          Terms.iri('sh:or'),
          [
            named('ex:Circle'),
            named('ex:Square')
          ]
        )
      },
      {
        'check': (result) => {
          const r0 = result.at(0);

          if (r0 === undefined) {
            throw new Error('expected element at 0');
          }
          assert.equal(r0['ex:count'], 42);
          assert.equal(r0['ex:active'], true);
          assert.equal(r0['ex:name'], 'Widget');
        },
        'name': 'happy: literal types preserved (integer, boolean, string)',
        'quads': [
          quad('ex:Item', 'ex:count', literal(42, 'xsd:integer')),
          quad('ex:Item', 'ex:active', literal(true, 'xsd:boolean')),
          quad('ex:Item', 'ex:name', literal('Widget'))
        ]
      },
      {
        'check': (result) => {
          const r0 = result.at(0);

          if (r0 === undefined) {
            throw new Error('expected element at 0');
          }
          assert.deepEqual(r0['rdfs:subClassOf'], { '@id': 'ex:Agent' });
        },
        'name': 'happy: NamedNode becomes @id reference',
        'quads': [quad('ex:Person', 'rdfs:subClassOf', named('ex:Agent'))]
      }
    ];

    for (const {
      'check': check, 'name': name, 'quads': quads
    } of termScenarios) {
      void it(name, () => {
        const result = JsonLdFormatter.fromQuads(quads);

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
  ): SchemaGraphRelationType {
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
      const index = ProjectionIndex.build([]);

      assert.equal(index.size, 0);
    });

    void it('groups relations by source ID', () => {
      const relations = [
        makeRelation('http://example.com/User', 'rdfs:label', 'User'),
        makeRelation('http://example.com/User', 'rdfs:comment', 'A user class'),
        makeRelation('http://example.com/Order', 'rdfs:label', 'Order')
      ];

      const index = ProjectionIndex.build(relations);

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

      const index = ProjectionIndex.build(relations);
      const entry = index.get('http://example.com/User');

      assert.equal(entry?.byPredicate.get('rdfs:label')?.length, 2);
      assert.equal(entry.byPredicate.get('rdfs:comment')?.length, 1);
    });

    void it('extracts rdf:type relations into types array', () => {
      const relations = [
        makeRelation('http://example.com/User', RDF.type, OWL.Class),
        makeRelation('http://example.com/User', 'rdfs:label', 'User'),
        makeRelation('http://example.com/User', RDF.type, 'http://www.w3.org/2000/01/rdf-schema#Resource')
      ];

      const index = ProjectionIndex.build(relations);
      const entry = index.get('http://example.com/User');

      assert.deepEqual(entry?.types, [
        OWL.Class,
        'http://www.w3.org/2000/01/rdf-schema#Resource'
      ]);
    });
  });

  void describe('relationTargetId', () => {
    void it('returns string target directly', () => {
      const relation = makeRelation('http://example.com/User', 'rdfs:label', 'User');

      assert.equal(ProjectionIndex.relationTargetId(relation), 'User');
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

      assert.equal(ProjectionIndex.relationTargetId(relation), 'http://example.com/Class');
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

      assert.equal(ProjectionIndex.isRestrictionStructure(structure), true);
    });

    void it('returns false for list kind', () => {
      const structure: RelationStructure = {
        'kind': 'list',
        'members': [
          'a',
          'b'
        ]
      };

      assert.equal(ProjectionIndex.isRestrictionStructure(structure), false);
    });

    void it('returns false for undefined', () => {
      const noStructure: RelationStructure | undefined = undefined;

      assert.equal(ProjectionIndex.isRestrictionStructure(noStructure), false);
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

      assert.equal(ProjectionIndex.isListStructure(structure), true);
    });

    void it('returns false for restriction kind', () => {
      const structure: RelationStructure = {
        'constraint': 'sh:minCount',
        'kind': 'restriction',
        'onProperty': 'http://example.com/User#age',
        'value': 0
      };

      assert.equal(ProjectionIndex.isListStructure(structure), false);
    });

    void it('returns false for undefined', () => {
      const noStructure: RelationStructure | undefined = undefined;

      assert.equal(ProjectionIndex.isListStructure(noStructure), false);
    });
  });
}

// ===========================================================================
// Source: serializerUtils.test.ts
// ===========================================================================
{
// ---------------------------------------------------------------------------
// BaseGraphSerializer.ensureArray()
// ---------------------------------------------------------------------------

  void describe('BaseGraphSerializer.ensureArray() + normalizeArrays() — Good/Bad/Ugly', () => {
    void it('ensureArray: wraps scalar, leaves array, no-op for missing key, handles empty object', () => {
      // Good: wraps single value
      const n1: Record<string, unknown> = { 'label': 'Person' };

      BaseGraphSerializer.ensureArray(n1, 'label');
      assert.deepEqual(n1.label, ['Person']);

      // Good: leaves existing array unchanged
      const n2: Record<string, unknown> = {
        'label': [
          'Person',
          'Human'
        ]
      };

      BaseGraphSerializer.ensureArray(n2, 'label');
      assert.deepEqual(n2.label, [
        'Person',
        'Human'
      ]);

      // Bad: no-op when key is undefined
      const n3: Record<string, unknown> = { 'label': 'Person' };

      BaseGraphSerializer.ensureArray(n3, 'missing');
      assert.equal(n3.missing, undefined);
      assert.equal(n3.label, 'Person');

      // Ugly: handles empty object
      const n4: Record<string, unknown> = {};

      BaseGraphSerializer.ensureArray(n4, 'any');
      assert.deepEqual(n4, {});
    });

    void it('normalizeArrays: single key, multi-key, recursive nested objects, recursive arrays, non-matching, null/primitive inputs', () => {
      // Good: wraps at specified key
      const n1: Record<string, unknown> = { 'label': 'Person' };

      BaseGraphSerializer.normalizeArrays(n1, ['label']);
      assert.deepEqual(n1.label, ['Person']);

      // Good: handles multiple keys
      const n2: Record<string, unknown> = {
        'comment': 'A person',
        'label': 'Person'
      };

      BaseGraphSerializer.normalizeArrays(n2, [
        'label',
        'comment'
      ]);
      assert.deepEqual(n2.label, ['Person']);
      assert.deepEqual(n2.comment, ['A person']);

      // Good: recursively processes nested objects
      const n3: Record<string, unknown> = {
        'child': { 'label': 'Nested' },
        'label': 'Root'
      };

      BaseGraphSerializer.normalizeArrays(n3, ['label']);
      assert.deepEqual(n3.label, ['Root']);
      assert.deepEqual((n3.child as Record<string, unknown>).label, ['Nested']);

      // Good: recursively processes arrays of objects
      const n4: Record<string, unknown> = {
        'items': [
          { 'label': 'First' },
          { 'label': 'Second' }
        ]
      };

      BaseGraphSerializer.normalizeArrays(n4, ['label']);
      const n4Items = n4.items as Array<Record<string, unknown>>;
      const n4Item0 = n4Items.at(0);

      if (n4Item0 === undefined) {
        throw new Error('expected element at 0');
      }
      const n4Item1 = n4Items.at(1);

      if (n4Item1 === undefined) {
        throw new Error('expected element at 1');
      }
      assert.deepEqual(n4Item0.label, ['First']);
      assert.deepEqual(n4Item1.label, ['Second']);

      // Ugly: leaves non-matching keys unchanged
      const n5: Record<string, unknown> = {
        'label': 'Person',
        'name': 'Alice'
      };

      BaseGraphSerializer.normalizeArrays(n5, ['label']);
      assert.deepEqual(n5.label, ['Person']);
      assert.equal(n5.name, 'Alice');

      // Ugly: null/primitive inputs do not throw
      BaseGraphSerializer.normalizeArrays(null, ['label']);
      BaseGraphSerializer.normalizeArrays('string', ['label']);
      BaseGraphSerializer.normalizeArrays(42, ['label']);
      BaseGraphSerializer.normalizeArrays(true, ['label']);
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
      const raw = builder.jsonLdObject()['@graph'] as unknown[];

      assert(raw.length > 0, 'toTbox() raw quads must be non-empty');
    });

    await it('raw output contains owl:Class declarations', () => {
      const builder = entities.toTbox();
      const raw = builder.jsonLdObject()['@graph'] as unknown[];

      assert.equal(hasType(raw, OWL_CLASS_IRI), true);
    });

    await it('raw output contains OWL property declarations (DatatypeProperty or ObjectProperty)', () => {
      const builder = entities.toTbox();
      const raw = builder.jsonLdObject()['@graph'] as unknown[];

      const hasDatatype = hasType(raw, OWL_DATATYPE_PROPERTY_IRI);
      const hasObjectProp = hasType(raw, 'http://www.w3.org/2002/07/owl#ObjectProperty');

      assert.equal(hasDatatype || hasObjectProp, true);
    });

    await it('raw output contains rdfs:domain triples', () => {
      const builder = entities.toTbox();
      const raw = builder.jsonLdObject()['@graph'] as unknown[];

      assert.equal(hasPredicate(raw, RDFS_DOMAIN_IRI), true);
    });

    await it('raw output does NOT contain sh:NodeShape triples (no SHACL)', () => {
      const builder = entities.toTbox();
      const raw = builder.jsonLdObject()['@graph'] as unknown[];

      assert.equal(hasType(raw, SH_NODE_SHAPE_IRI), false);
    });

    await it('raw output does NOT contain sh:property triples (no SHACL)', () => {
      const builder = entities.toTbox();
      const raw = builder.jsonLdObject()['@graph'] as unknown[];

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
      const raw = builder.jsonLdObject()['@graph'] as unknown[];

      assert.equal(hasType(raw, OWL_CLASS_IRI), false);
    });

    await it('raw OWL output is empty — no rdfs:domain triples', () => {
      const builder = entities.toShacl();
      const raw = builder.jsonLdObject()['@graph'] as unknown[];

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
      const raw = builder.jsonLdObject()['@graph'] as unknown[];

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

  // Normalize transform: decode canonicalizes a raw date string into the
  // schema's canonical (branded) ISO date-time form; encode is the inverse.
  const TransformedDateSchema = Transform.create(DateTimeSchema, {
    'decode': (raw: string) => {
      return Brand.cast<InferSchemaType<typeof DateTimeSchema>>(new Date(raw).toISOString());
    },
    'encode': (value) => {
      return value;
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
  // dump — Good/Bad/Ugly (all options)
  // ---------------------------------------------------------------------------

  void describe('dump — basic copy + filter options — Good/Bad/Ugly', () => {
    void it('structural copy: structurally equal, new reference, nested objects, array items', () => {
      const jt = makeJt();
      const value = {
        'age': 30,
        'name': 'Alice'
      };
      const result = jt.dump(PersonSchema.$id, value);

      assert.deepEqual(result, value);
      assert.notEqual(result, value);

      // nested objects
      const nested = {
        'address': {
          'city': 'Portland',
          'zip': '97201'
        },
        'name': 'Alice'
      };
      const nestedResult = jt.dump(EmployeeSchema.$id, nested);

      assert.deepEqual(nestedResult, nested);

      // array items
      const withTags = {
        'name': 'Alice',
        'tags': [
          'engineer',
          'ts'
        ]
      };
      const tagsResult = jt.dump(EmployeeSchema.$id, withTags);

      assert.deepEqual(tagsResult.tags, [
        'engineer',
        'ts'
      ]);
    });

    void it('filter options: exclude, include, excludeUnset, excludeDefaults', () => {
      const jt = makeJt();

      // exclude drops listed props
      const excl = jt.dump(PersonSchema.$id, {
        'age': 30,
        'name': 'Alice'
      }, { 'exclude': ['age'] });

      assert.equal('age' in excl, false);
      assert.equal(excl.name, 'Alice');

      // exclude with unknown prop is a no-op
      const exclNoop = jt.dump(PersonSchema.$id, {
        'age': 30,
        'name': 'Alice'
      }, { 'exclude': ['nonexistent'] });

      assert.deepEqual(exclNoop, {
        'age': 30,
        'name': 'Alice'
      });

      // include keeps only listed
      const incl = jt.dump(PersonSchema.$id, {
        'age': 30,
        'name': 'Alice'
      }, { 'include': ['name'] });

      assert.equal(incl.name, 'Alice');
      assert.equal('age' in incl, false);

      // include wins over exclude
      const inclOverExcl = jt.dump(PersonSchema.$id, {
        'age': 30,
        'name': 'Alice'
      }, {
        'exclude': ['name'],
        'include': ['name']
      });

      assert.equal(inclOverExcl.name, 'Alice');
      assert.equal('age' in inclOverExcl, false);

      // excludeUnset drops undefined-value props. The value deliberately carries an
      // explicit age: undefined to exercise that path; exactOptionalPropertyTypes
      // forbids undefined on the schema's optional-number field, so this malformed
      // instance is widened at the ingestion boundary and the result is asserted.
      const unsetInput = {
        'age': undefined,
        'name': 'Alice'
      } satisfies Record<string, unknown>;
      // invalid-input edge: age: undefined violates exactOptionalPropertyTypes on
      // the branded dump parameter; the cast simulates a value crossing the
      // boundary with an explicit undefined to exercise excludeUnset behaviour.
      const unset = jt.dump(
        PersonSchema.$id,
        unsetInput as unknown as {
          readonly 'age'?: number;
          readonly 'name': string;
        },
        { 'excludeUnset': true }
      );

      assert.equal('age' in unset, false);
      assert.equal(unset.name, 'Alice');

      // excludeUnset keeps 0 (not unset)
      const zero = jt.dump(PersonSchema.$id, {
        'age': 0,
        'name': 'Alice'
      }, { 'excludeUnset': true });

      assert.equal(zero.age, 0);

      // excludeDefaults drops default-value props (age default = 0)
      const defaults = jt.dump(PersonSchema.$id, {
        'age': 0,
        'name': 'Alice'
      }, { 'excludeDefaults': true });

      assert.equal('age' in defaults, false);
      assert.equal(defaults.name, 'Alice');

      // excludeDefaults keeps non-default value
      const nonDefault = jt.dump(PersonSchema.$id, {
        'age': 25,
        'name': 'Alice'
      }, { 'excludeDefaults': true });

      assert.equal(nonDefault.age, 25);

      // exclude applies to nested objects
      const exclNested = jt.dump(EmployeeSchema.$id, {
        'address': {
          'city': 'Portland',
          'zip': '97201'
        },
        'name': 'Alice'
      }, { 'exclude': ['address'] });

      assert.equal('address' in exclNested, false);
      assert.equal(exclNested.name, 'Alice');
    });
  });

  void describe('dump — Transform encoder + json mode — Good/Bad/Ugly', () => {
    void it('Transform encode, round-trip, json mode Date conversion, json mode no-op for plain objects', () => {
      const jt = makeJt();

      // Transform: encode produces wire form (canonical string → wire string)
      const isoString = '2026-01-01T00:00:00.000Z';

      assert.equal(jt.dump(TransformedDateSchema.$id, Brand.cast<InferSchemaType<typeof DateTimeSchema>>(isoString)), isoString);

      // Transform: round-trip decode then dump
      const isoString2 = '2026-06-15T12:00:00.000Z';
      const decoded = jt.instantiate(TransformedDateSchema.$id, isoString2);

      assert.equal(jt.dump(TransformedDateSchema.$id, decoded), isoString2);

      // mode 'json': the canonical string round-trips as the wire string
      assert.equal(jt.dump(TransformedDateSchema.$id, Brand.cast<InferSchemaType<typeof DateTimeSchema>>(isoString), { 'mode': 'json' }), isoString);

      // mode 'json': plain object untouched
      const plain = {
        'age': 30,
        'name': 'Alice'
      };

      assert.deepEqual(jt.dump(PersonSchema.$id, plain, { 'mode': 'json' }), plain);
    });
  });

  void describe('dumpJson — Good/Bad/Ugly', () => {
    void it('returns JSON string, round-trips, supports exclude, schema object overload', () => {
      const jt = makeJt();
      const value = {
        'age': 30,
        'name': 'Alice'
      };

      // returns string
      assert.equal(typeof jt.dumpJson(PersonSchema.$id, value), 'string');

      // JSON.parse equals original
      assert.deepEqual(JSON.parse(jt.dumpJson(PersonSchema.$id, value)), value);

      // Date values serialized as ISO strings
      const isoString = '2026-01-01T00:00:00.000Z';
      const decoded = jt.instantiate(TransformedDateSchema.$id, isoString);

      assert.equal(JSON.parse(jt.dumpJson(TransformedDateSchema.$id, decoded)) as string, isoString);

      // exclude drops field in JSON output
      const parsed = JSON.parse(jt.dumpJson(PersonSchema.$id, value, { 'exclude': ['age'] })) as Record<string, unknown>;

      assert.equal('age' in parsed, false);
      assert.equal(parsed.name, 'Alice');

      // schema object overload == schema ID overload
      assert.equal(jt.dumpJson(PersonSchema.$id, value), jt.dumpJson(PersonSchema, value));
    });
  });
}

