/**
 * Unit tests for the QuadBackedSchemaGraph extensions:
 *   - `collectList(head)` — walk rdf:first/rdf:rest chains
 *   - `relationsForSubject(subjectIri)` — lookup outgoing relations on any subject
 *   - Literal-tag preservation (`relation.language`, `relation.datatype`,
 *     `relation.termType`) on relation objects
 *
 * These methods underpin the OWL importDispatch dispatchers' graph-native
 * traversal of RDF lists, blank-node sibling predicates, and language /
 * datatype tagged literals.
 */

import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';
import type { QuadInterface } from '../../src/interfaces/Quad.js';
import { SchemaGraph } from '../../src/modules/graph/SchemaGraph.js';
import { Terms } from '../../src/modules/rdf/Terms.js';
import { listQuad } from '../helpers/listQuad.js';

const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const RDFS_LABEL = 'http://www.w3.org/2000/01/rdf-schema#label';
const OWL_CLASS = 'http://www.w3.org/2002/07/owl#Class';
const OWL_INTERSECTION_OF = 'http://www.w3.org/2002/07/owl#intersectionOf';
const OWL_RESTRICTION = 'http://www.w3.org/2002/07/owl#Restriction';
const OWL_ON_PROPERTY = 'http://www.w3.org/2002/07/owl#onProperty';
const OWL_HAS_VALUE = 'http://www.w3.org/2002/07/owl#hasValue';
const XSD_INTEGER = 'http://www.w3.org/2001/XMLSchema#integer';
const XSD_STRING = 'http://www.w3.org/2001/XMLSchema#string';

void describe('QuadBackedSchemaGraph.collectList', { 'concurrency': true }, () => {
  void it('walks a rdf:first/rdf:rest chain of named-node items', () => {
    const subject = 'urn:test:Subject';
    const itemA = 'urn:test:A';
    const itemB = 'urn:test:B';
    const itemC = 'urn:test:C';

    const quads: QuadInterface[] = [...listQuad(
      Terms.iri(subject),
      Terms.iri(OWL_INTERSECTION_OF),
      [
        Terms.iri(itemA),
        Terms.iri(itemB),
        Terms.iri(itemC)
      ]
    )];

    const graph = SchemaGraph.fromQuads(quads, { 'baseIRI': 'urn:test' });
    // The parent quad's object is the bnode list head.
    const parentRelation = graph.allRelations().find((rel) => {
      return rel.predicate === 'owl:intersectionOf' || rel.predicate === OWL_INTERSECTION_OF;
    });

    assert.ok(parentRelation !== undefined, 'parent intersectionOf relation must be present');
    const listHead = typeof parentRelation.target === 'string'
      ? parentRelation.target
      : parentRelation.target.id;

    const items = graph.collectList(listHead);

    assert.equal(items.length, 3, 'three list items collected');
    assert.equal(items[0].termType, 'NamedNode');
    assert.equal(items[0].target, itemA);
    assert.equal(items[1].target, itemB);
    assert.equal(items[2].target, itemC);
  });

  void it('returns an empty array for rdf:nil heads', () => {
    const graph = SchemaGraph.fromQuads([], { 'baseIRI': 'urn:test' });

    assert.deepEqual(graph.collectList('http://www.w3.org/1999/02/22-rdf-syntax-ns#nil'), []);
    assert.deepEqual(graph.collectList(''), []);
  });

  void it('preserves Literal items with their datatype IRI', () => {
    const subject = 'urn:test:Subject';
    const quads: QuadInterface[] = listQuad(
      Terms.iri(subject),
      Terms.iri(OWL_INTERSECTION_OF),
      [
        Terms.literal(42, { 'datatype': Terms.iri(XSD_INTEGER) }),
        Terms.literal('hello', { 'datatype': Terms.iri(XSD_STRING) })
      ]
    );

    const graph = SchemaGraph.fromQuads(quads, { 'baseIRI': 'urn:test' });
    const parent = graph.allRelations().find((rel) => {
      return rel.predicate === 'owl:intersectionOf' || rel.predicate === OWL_INTERSECTION_OF;
    });

    assert.ok(parent !== undefined);
    const head = typeof parent.target === 'string' ? parent.target : parent.target.id;
    const items = graph.collectList(head);

    assert.equal(items.length, 2);
    assert.equal(items[0].termType, 'Literal');
    assert.equal(items[0].datatype, XSD_INTEGER);
    assert.equal(items[1].termType, 'Literal');
    assert.equal(items[1].datatype, XSD_STRING);
    assert.equal(items[1].target, 'hello');
  });
});

void describe('QuadBackedSchemaGraph.relationsForSubject', { 'concurrency': true }, () => {
  void it('returns every outgoing relation for a named subject', () => {
    const classIri = 'urn:test:Person';
    const quads: QuadInterface[] = [
      {
        'graph': Terms.defaultGraph(),
        'object': Terms.iri(OWL_CLASS),
        'predicate': Terms.iri(RDF_TYPE),
        'subject': Terms.iri(classIri)
      },
      {
        'graph': Terms.defaultGraph(),
        'object': Terms.literal('Person', { 'datatype': Terms.iri(XSD_STRING) }),
        'predicate': Terms.iri(RDFS_LABEL),
        'subject': Terms.iri(classIri)
      }
    ];

    const graph = SchemaGraph.fromQuads(quads, { 'baseIRI': 'urn:test' });
    const relations = graph.relationsForSubject(classIri);

    assert.equal(relations.length, 2);
    const predicates = new Set(relations.map((rel) => {
      return rel.predicate;
    }));

    assert.ok(predicates.has('rdf:type') || predicates.has(RDF_TYPE));
    assert.ok(predicates.has('rdfs:label') || predicates.has(RDFS_LABEL));
  });

  void it('returns blank-node sibling predicates for Restriction-style nodes', () => {
    const bnodeId = 'restriction-1';
    const propIri = 'urn:test:hasKind';
    const valueLit = 'circle';

    const quads: QuadInterface[] = [
      {
        'graph': Terms.defaultGraph(),
        'object': Terms.iri(OWL_RESTRICTION),
        'predicate': Terms.iri(RDF_TYPE),
        'subject': Terms.blank(bnodeId)
      },
      {
        'graph': Terms.defaultGraph(),
        'object': Terms.iri(propIri),
        'predicate': Terms.iri(OWL_ON_PROPERTY),
        'subject': Terms.blank(bnodeId)
      },
      {
        'graph': Terms.defaultGraph(),
        'object': Terms.literal(valueLit, { 'datatype': Terms.iri(XSD_STRING) }),
        'predicate': Terms.iri(OWL_HAS_VALUE),
        'subject': Terms.blank(bnodeId)
      }
    ];

    const graph = SchemaGraph.fromQuads(quads, { 'baseIRI': 'urn:test' });
    const siblings = graph.relationsForSubject(bnodeId);

    assert.equal(siblings.length, 3, 'all three sibling predicates returned');

    const hasValueRel = siblings.find((rel) => {
      return rel.predicate === 'owl:hasValue' || rel.predicate === OWL_HAS_VALUE;
    });

    assert.ok(hasValueRel !== undefined, 'owl:hasValue sibling present');
    assert.equal(hasValueRel.termType, 'Literal', 'literal target preserved');
    assert.equal(hasValueRel.datatype, XSD_STRING, 'literal datatype preserved');
    assert.equal(
      typeof hasValueRel.target === 'string' ? hasValueRel.target : hasValueRel.target.id,
      valueLit
    );
  });

  void it('returns an empty array for unknown subjects', () => {
    const graph = SchemaGraph.fromQuads([], { 'baseIRI': 'urn:test' });

    assert.deepEqual(graph.relationsForSubject('urn:nope'), []);
  });
});

void describe('QuadBackedSchemaGraph literal-tag preservation', { 'concurrency': true }, () => {
  void it('exposes language tags on rdfs:label relations', () => {
    const subject = 'urn:test:Subject';
    const quads: QuadInterface[] = [
      {
        'graph': Terms.defaultGraph(),
        'object': Terms.literal('Bonjour', {
          'datatype': Terms.iri('http://www.w3.org/1999/02/22-rdf-syntax-ns#langString'),
          'language': 'fr'
        }),
        'predicate': Terms.iri(RDFS_LABEL),
        'subject': Terms.iri(subject)
      },
      {
        'graph': Terms.defaultGraph(),
        'object': Terms.literal('Hello', {
          'datatype': Terms.iri('http://www.w3.org/1999/02/22-rdf-syntax-ns#langString'),
          'language': 'en'
        }),
        'predicate': Terms.iri(RDFS_LABEL),
        'subject': Terms.iri(subject)
      }
    ];

    const graph = SchemaGraph.fromQuads(quads, { 'baseIRI': 'urn:test' });
    const labels = graph.relationsForSubject(subject).filter((rel) => {
      return rel.predicate === 'rdfs:label' || rel.predicate === RDFS_LABEL;
    });

    assert.equal(labels.length, 2);
    const byLang = new Map(labels.map((rel) => {
      return [
        rel.language,
        typeof rel.target === 'string' ? rel.target : rel.target.id
      ] as const;
    }));

    assert.equal(byLang.get('fr'), 'Bonjour');
    assert.equal(byLang.get('en'), 'Hello');
  });

  void it('exposes datatype IRIs on typed-literal relations', () => {
    const subject = 'urn:test:Datatype';
    const facetPred = 'http://www.w3.org/2001/XMLSchema#minInclusive';
    const quads: QuadInterface[] = [{
      'graph': Terms.defaultGraph(),
      'object': Terms.literal(5, { 'datatype': Terms.iri(XSD_INTEGER) }),
      'predicate': Terms.iri(facetPred),
      'subject': Terms.iri(subject)
    }];

    const graph = SchemaGraph.fromQuads(quads, { 'baseIRI': 'urn:test' });
    const relations = graph.relationsForSubject(subject);

    assert.equal(relations.length, 1);
    assert.equal(relations[0].termType, 'Literal');
    assert.equal(relations[0].datatype, XSD_INTEGER);
    assert.equal(
      typeof relations[0].target === 'string' ? relations[0].target : relations[0].target.id,
      '5'
    );
  });
});
