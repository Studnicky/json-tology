/**
 * Direct unit tests for SchemaGraphRelations.extractRelations().
 *
 * extractRelations() maps a single SchemaGraph node + its siblings into an
 * array of SchemaGraphRelationInterface objects. We verify the relation
 * predicates and targets for the behaviorally significant cases.
 *
 * Approach: build a real SchemaGraph and drive allRelations() which calls
 * extractRelations() internally for every node. No mocking.
 */

import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';
import { SchemaGraph } from '../../src/modules/graph/SchemaGraph.js';
import {
  OWL, RDF, RDFS, SH
} from '../../src/constants/IRI.js';
import type { SchemaGraphRelationInterface } from '../../src/interfaces/SchemaGraph.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type RelationArray = SchemaGraphRelationInterface[];

/**
 * Build a SchemaGraph and collect the full relation set via allRelations().
 * allRelations() calls extractRelations() internally per node.
 */
function graphRelations(schema: Record<string, unknown>): RelationArray {
  return new SchemaGraph(schema).allRelations();
}

/**
 * Filter relations by predicate string.
 */
function filterByPredicate(relations: RelationArray, predicate: string): RelationArray {
  return relations.filter((rel) => {
    return rel.predicate === predicate;
  });
}

/**
 * Find the target id string for a relation (handles string and node targets).
 */
function resolveTargetId(rel: SchemaGraphRelationInterface): string {
  if (typeof rel.target === 'string') {
    return rel.target;
  }

  return rel.target.id;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

void describe('SchemaGraphRelations.extractRelations()', { 'concurrency': true }, () => {
  void it('emits rdf:type owl:Class for the root node of a schema with $id', () => {
    const schema = {
      '$id': 'https://example.io/Person',
      'type': 'object'
    } as const;

    const relations = graphRelations(schema);
    const classRels = filterByPredicate(relations, RDF.type).filter((rel) => {
      return resolveTargetId(rel) === OWL.Class;
    });

    assert.ok(classRels.length > 0, 'root node of named schema should emit owl:Class relation');
  });

  void it('emits rdfs:domain relation linking a property node to its parent class', () => {
    const schema = {
      '$id': 'https://example.io/Product',
      'properties': { 'price': { 'type': 'number' } },
      'type': 'object'
    } as const;

    const relations = graphRelations(schema);
    const domainRels = filterByPredicate(relations, RDFS.domain);

    assert.ok(domainRels.length > 0, 'property node should emit rdfs:domain');
    const productClassId = 'https://example.io/Product';
    const hasDomainToProduct = domainRels.some((rel) => {
      return resolveTargetId(rel) === productClassId;
    });

    assert.ok(hasDomainToProduct, `rdfs:domain should point to ${productClassId}`);
  });

  void it('emits rdfs:subClassOf for allOf composition', () => {
    const schema = {
      '$id': 'https://example.io/Employee',
      'allOf': [{ '$ref': 'https://example.io/Person' }],
      'type': 'object'
    } as const;

    const relations = graphRelations(schema);
    const subClassRels = filterByPredicate(relations, RDFS.subClassOf);

    assert.ok(subClassRels.length > 0, 'allOf should produce rdfs:subClassOf relations');
    const targetsPersonIri = subClassRels.some((rel) => {
      return resolveTargetId(rel) === 'https://example.io/Person';
    });

    assert.ok(targetsPersonIri, 'rdfs:subClassOf should target the $ref IRI from allOf');
  });

  void it('emits owl:equivalentClass for oneOf branches', () => {
    const schema = {
      '$id': 'https://example.io/Shape',
      'oneOf': [
        { '$ref': 'https://example.io/Circle' },
        { '$ref': 'https://example.io/Rect' }
      ]
    } as const;

    const relations = graphRelations(schema);
    const equivRels = filterByPredicate(relations, OWL.equivalentClass);

    assert.ok(equivRels.length > 0, 'oneOf should produce owl:equivalentClass relations');
  });

  void it('emits rdfs:range for a $ref typed property', () => {
    const schema = {
      '$id': 'https://example.io/Order',
      'properties': { 'customer': { '$ref': 'https://example.io/Customer' } },
      'type': 'object'
    } as const;

    const relations = graphRelations(schema);
    const rangeRels = filterByPredicate(relations, RDFS.range);

    assert.ok(rangeRels.length > 0, '$ref property should emit rdfs:range');
    const targetsCustomer = rangeRels.some((rel) => {
      return resolveTargetId(rel) === 'https://example.io/Customer';
    });

    assert.ok(targetsCustomer, 'rdfs:range should target the $ref IRI');
  });

  void it('emits sh:closed when additionalProperties is false', () => {
    const schema = {
      '$id': 'https://example.io/Strict',
      'additionalProperties': false,
      'properties': { 'x': { 'type': 'string' } },
      'type': 'object'
    } as const;

    const relations = graphRelations(schema);
    const closedRels = filterByPredicate(relations, SH.closed);

    assert.ok(closedRels.length > 0, 'additionalProperties: false should emit sh:closed');
    assert.equal(resolveTargetId(closedRels[0]), 'true');
  });

  void it('emits owl:oneOf for enum values', () => {
    const schema = {
      '$id': 'https://example.io/Status',
      'enum': [
        'active',
        'inactive',
        'pending'
      ],
      'type': 'string'
    } as const;

    const relations = graphRelations(schema);
    const oneOfRels = filterByPredicate(relations, OWL.oneOf);

    assert.equal(oneOfRels.length, 3, 'each enum member should produce one owl:oneOf relation');
    const targets = new Set(oneOfRels.map((rel) => {
      return resolveTargetId(rel);
    }));

    assert.ok(targets.has('active'));
    assert.ok(targets.has('inactive'));
    assert.ok(targets.has('pending'));
  });

  void it('emits sh:datatype for a typed scalar property', () => {
    const schema = {
      '$id': 'https://example.io/Article',
      'properties': { 'title': { 'type': 'string' } },
      'type': 'object'
    } as const;

    const relations = graphRelations(schema);
    const dtRels = filterByPredicate(relations, SH.datatype);

    assert.ok(dtRels.length > 0, 'string property should emit sh:datatype');
    const hasString = dtRels.some((rel) => {
      return resolveTargetId(rel).includes('string');
    });

    assert.ok(hasString, `sh:datatype should include an xsd:string variant; got: ${dtRels.map((rel) => {
      return resolveTargetId(rel);
    }).join(', ')}`);
  });

  void it('emits owl:Restriction (minCardinality=1) for required properties', () => {
    const schema = {
      '$id': 'https://example.io/Task',
      'properties': {
        'name': { 'type': 'string' },
        'optional': { 'type': 'string' }
      },
      'required': ['name'],
      'type': 'object'
    } as const;

    const relations = graphRelations(schema);
    const restrictionRels = filterByPredicate(relations, OWL.Restriction);

    assert.ok(restrictionRels.length > 0, 'required property should emit owl:Restriction');
    const hasMinCard1 = restrictionRels.some((rel) => {
      const meta = rel.metadata;

      return meta?.minCardinality === 1;
    });

    assert.ok(hasMinCard1, 'owl:Restriction should carry minCardinality: 1 for required field');
  });

  void it('allRelations() returns a stable non-empty array for non-trivial schema', () => {
    const schema = {
      '$id': 'https://example.io/Stable',
      'properties': {
        'a': { 'type': 'string' },
        'b': { 'type': 'number' }
      },
      'required': ['a'],
      'type': 'object'
    } as const;

    const first = graphRelations(schema);
    const second = graphRelations(schema);

    assert.ok(first.length > 0, 'allRelations() should return non-empty array');
    assert.equal(first.length, second.length, 'allRelations() should return stable count for same schema');
  });
});
