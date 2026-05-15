/**
 * Direct unit tests for OwlProjection.graph().
 *
 * OwlProjection.graph() takes a SchemaGraphInterface and returns an array of
 * quads encoding the OWL TBox vocabulary. We drive it with real SchemaGraph
 * instances and assert on subjects, predicates, and object values.
 *
 * IRI constants use the short curie form from src/constants/IRI.ts.
 */

import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';
import { SchemaGraph } from '../../src/modules/graph/SchemaGraph.js';
import { OwlProjection } from '../../src/modules/rdf/OwlProjection.js';
import {
  OWL, RDF, RDFS
} from '../../src/constants/IRI.js';
import type { QuadInterface } from '../../src/interfaces/Quad.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function project(schema: Record<string, unknown>): QuadInterface[] {
  return OwlProjection.graph(new SchemaGraph(schema));
}

function filterByPredicate(quads: QuadInterface[], predicate: string): QuadInterface[] {
  return quads.filter((quad) => {
    return quad.predicate === predicate;
  });
}

function filterBySubjectAndPredicate(quads: QuadInterface[], subject: string, predicate: string): QuadInterface[] {
  return quads.filter((quad) => {
    return quad.subject === subject && quad.predicate === predicate;
  });
}

function objectNamedNodeValue(quad: QuadInterface): string | undefined {
  const obj = quad.object;

  if (obj.termType === 'NamedNode') {
    return obj.value;
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

void describe('OwlProjection.graph()', { 'concurrency': true }, () => {
  void it('emits owl:Class for a root object schema with $id', () => {
    const schema = {
      '$id': 'https://example.io/Person',
      'type': 'object'
    } as const;

    const quads = project(schema);
    const classQuads = quads.filter((quad) => {
      return quad.subject === schema.$id
        && quad.predicate === RDF.type
        && objectNamedNodeValue(quad) === OWL.Class;
    });

    assert.ok(classQuads.length > 0, 'root object schema should produce rdf:type owl:Class quad');
  });

  void it('emits owl:DatatypeProperty for a scalar typed property', () => {
    const schema = {
      '$id': 'https://example.io/Article',
      'properties': { 'title': { 'type': 'string' } },
      'type': 'object'
    } as const;

    const quads = project(schema);
    const dtPropQuads = quads.filter((quad) => {
      return quad.predicate === RDF.type && objectNamedNodeValue(quad) === OWL.DatatypeProperty;
    });

    assert.ok(dtPropQuads.length > 0, 'string property should produce owl:DatatypeProperty quad');
    const propSubject = dtPropQuads[0].subject;

    assert.ok(
      typeof propSubject === 'string' && propSubject.includes('title'),
      `DatatypeProperty subject should include property name; got: ${propSubject}`
    );
  });

  void it('emits owl:ObjectProperty for a $ref typed property', () => {
    const schema = {
      '$id': 'https://example.io/Order',
      'properties': { 'customer': { '$ref': 'https://example.io/Customer' } },
      'type': 'object'
    } as const;

    const quads = project(schema);
    const objPropQuads = quads.filter((quad) => {
      return quad.predicate === RDF.type && objectNamedNodeValue(quad) === OWL.ObjectProperty;
    });

    assert.ok(objPropQuads.length > 0, '$ref property should produce owl:ObjectProperty quad');
    const propSubject = objPropQuads[0].subject;

    assert.ok(
      typeof propSubject === 'string' && propSubject.includes('customer'),
      `ObjectProperty subject should include property name; got: ${propSubject}`
    );
  });

  void it('emits rdfs:domain linking property to its owning class', () => {
    const schema = {
      '$id': 'https://example.io/Invoice',
      'properties': { 'amount': { 'type': 'number' } },
      'type': 'object'
    } as const;

    const quads = project(schema);
    const domainQuads = filterByPredicate(quads, RDFS.domain);

    assert.ok(domainQuads.length > 0, 'property should produce rdfs:domain quad');
    const targetsClass = domainQuads.some((quad) => {
      const iri = objectNamedNodeValue(quad);

      return typeof iri === 'string' && iri.includes('Invoice');
    });

    assert.ok(targetsClass, 'rdfs:domain should reference the parent class IRI');
  });

  void it('emits rdfs:range for a $ref property', () => {
    const schema = {
      '$id': 'https://example.io/Team',
      'properties': { 'lead': { '$ref': 'https://example.io/Person' } },
      'type': 'object'
    } as const;

    const quads = project(schema);
    const rangeQuads = filterByPredicate(quads, RDFS.range);

    assert.ok(rangeQuads.length > 0, '$ref property should produce rdfs:range quad');
    const targetsPersonIri = rangeQuads.some((quad) => {
      const iri = objectNamedNodeValue(quad);

      return typeof iri === 'string' && iri.includes('Person');
    });

    assert.ok(targetsPersonIri, 'rdfs:range should reference the $ref target IRI');
  });

  void it('emits rdfs:subClassOf for allOf inheritance', () => {
    const schema = {
      '$id': 'https://example.io/Employee',
      'allOf': [{ '$ref': 'https://example.io/Person' }],
      'type': 'object'
    } as const;

    const quads = project(schema);
    const subClassQuads = filterBySubjectAndPredicate(quads, schema.$id, RDFS.subClassOf);

    assert.ok(subClassQuads.length > 0, 'allOf should produce rdfs:subClassOf quad');
    const targetsPersonIri = subClassQuads.some((quad) => {
      const iri = objectNamedNodeValue(quad);

      return typeof iri === 'string' && iri.includes('Person');
    });

    assert.ok(targetsPersonIri, 'rdfs:subClassOf should target the $ref IRI from allOf');
  });

  void it('emits owl:oneOf for enum schemas', () => {
    const schema = {
      '$id': 'https://example.io/Color',
      'enum': [
        'red',
        'green',
        'blue'
      ],
      'type': 'string'
    } as const;

    const quads = project(schema);
    const oneOfQuads = filterBySubjectAndPredicate(quads, schema.$id, OWL.oneOf);

    assert.ok(oneOfQuads.length > 0, 'enum schema should produce owl:oneOf quad');
  });

  void it('emits owl:Restriction bnode for a required property (cardinality)', () => {
    const schema = {
      '$id': 'https://example.io/Contract',
      'properties': {
        'id': { 'type': 'string' },
        'optional': { 'type': 'string' }
      },
      'required': ['id'],
      'type': 'object'
    } as const;

    const quads = project(schema);
    const restrictionTypeQuads = quads.filter((quad) => {
      return quad.predicate === RDF.type && objectNamedNodeValue(quad) === OWL.Restriction;
    });

    assert.ok(restrictionTypeQuads.length > 0, 'required property should produce owl:Restriction bnode');
  });

  void it('emits owl:equivalentClass for anyOf/oneOf composition', () => {
    const schema = {
      '$id': 'https://example.io/Shape',
      'anyOf': [
        { '$ref': 'https://example.io/Circle' },
        { '$ref': 'https://example.io/Rect' }
      ]
    } as const;

    const quads = project(schema);
    const equivQuads = filterBySubjectAndPredicate(quads, schema.$id, OWL.equivalentClass);

    assert.ok(equivQuads.length > 0, 'anyOf should produce owl:equivalentClass quad');
  });

  void it('does not throw for schema without $id (anonymous graph)', () => {
    const schema = {
      'properties': { 'x': { 'type': 'string' } },
      'type': 'object'
    } as const;

    assert.doesNotThrow(() => {
      OwlProjection.graph(new SchemaGraph(schema));
    });
  });
});
