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
import type { QuadInterface } from '../../src/interfaces/QuadInterface.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function project(schema: Record<string, unknown>): QuadInterface[] {
  return OwlProjection.graph(new SchemaGraph(schema));
}

function filterByPredicate(quads: QuadInterface[], predicate: string): QuadInterface[] {
  return quads.filter((quad) => {
    return quad.predicate.value === predicate;
  });
}

function filterBySubjectAndPredicate(quads: QuadInterface[], subject: string, predicate: string): QuadInterface[] {
  return quads.filter((quad) => {
    return quad.subject.value === subject && quad.predicate.value === predicate;
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
      return quad.subject.value === schema.$id
        && quad.predicate.value === RDF.type
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
      return quad.predicate.value === RDF.type && objectNamedNodeValue(quad) === OWL.DatatypeProperty;
    });

    assert.ok(dtPropQuads.length > 0, 'string property should produce owl:DatatypeProperty quad');
    const dtPropQuad0 = dtPropQuads.at(0);

    if (dtPropQuad0 === undefined) {
      throw new Error('expected DatatypeProperty quad at index 0');
    }
    const propSubject = dtPropQuad0.subject.value;

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
      return quad.predicate.value === RDF.type && objectNamedNodeValue(quad) === OWL.ObjectProperty;
    });

    assert.ok(objPropQuads.length > 0, '$ref property should produce owl:ObjectProperty quad');
    const objPropQuad0 = objPropQuads.at(0);

    if (objPropQuad0 === undefined) {
      throw new Error('expected ObjectProperty quad at index 0');
    }
    const propSubject = objPropQuad0.subject.value;

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

    // Enum primitives are emitted as rdfs:Datatype + owl:equivalentClass + owl:oneOf
    // (OWL 2 §9.4 DataTypeDefinition pattern), not owl:Class + owl:oneOf directly.
    const equivClassQuads = filterBySubjectAndPredicate(quads, schema.$id, OWL.equivalentClass);

    assert.ok(equivClassQuads.length > 0, 'enum schema should produce owl:equivalentClass quad');

    const oneOfQuads = quads.filter((quad) => {
      return quad.predicate.value === OWL.oneOf;
    });

    assert.ok(oneOfQuads.length > 0, 'enum schema should produce owl:oneOf quad (on equivalentClass bnode)');
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
      return quad.predicate.value === RDF.type && objectNamedNodeValue(quad) === OWL.Restriction;
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

// ===========================================================================
// Full-IRI wire-format guard — acceptance criterion for Wave 1 (Phase 2)
//
// Every term `.value` emitted by OwlProjection.graph, ShaclProjection.graph,
// and Projection.abox — called WITHOUT a `curie` option — must be a full IRI.
// Compact CURIEs (e.g. 'xsd:string', 'owl:Class', 'rdf:type') must never
// leak into the quad stream.
// ===========================================================================

import { ShaclProjection } from '../../src/modules/rdf/ShaclProjection.js';
import { Projection } from '../../src/modules/rdf/Projection.js';

const FULL_IRI_RE = /^(?:https?:|urn:|_:)/u;

function assertAllTermsFullIri(quads: QuadInterface[], label: string): void {
  for (const quad of quads) {
    const terms: Array<{ 'termType': string;
      'value': string }> = [
      quad.subject,
      quad.predicate
    ];
    const obj = quad.object;

    if (obj.termType === 'NamedNode') {
      terms.push(obj);
    } else if (obj.termType === 'Literal') {
      terms.push(obj.datatype);
    }

    if (quad.graph.termType !== 'DefaultGraph') {
      terms.push(quad.graph);
    }

    for (const term of terms) {
      if (term.termType === 'BlankNode') {
        continue;
      }
      assert.ok(
        FULL_IRI_RE.test(term.value),
        `${label}: term type=${term.termType} value="${term.value}" is not a full IRI`
      );
    }
  }
}

void describe('Full-IRI wire-format guard', () => {
  const guardSchema = {
    '$id': 'https://example.com/GuardTest',
    'description': 'A test class',
    'properties': {
      'active': { 'type': 'boolean' },
      'count': { 'type': 'integer' },
      'name': {
        'maxLength': 50,
        'minLength': 1,
        'type': 'string'
      },
      'score': {
        'maximum': 100,
        'minimum': 0,
        'type': 'number'
      }
    },
    'required': ['name'],
    'title': 'GuardTest',
    'type': 'object'
  };

  void it('OwlProjection.graph emits only full IRIs (no curie option)', () => {
    const quads = OwlProjection.graph(new SchemaGraph(guardSchema));

    assert.ok(quads.length > 0, 'should emit at least one quad');
    assertAllTermsFullIri(quads, 'OwlProjection.graph');
  });

  void it('ShaclProjection.graph emits only full IRIs (no curie option)', () => {
    const quads = ShaclProjection.graph(new SchemaGraph(guardSchema));

    assert.ok(quads.length > 0, 'should emit at least one quad');
    assertAllTermsFullIri(quads, 'ShaclProjection.graph');
  });

  void it('Projection.abox emits only full IRIs (no curie option)', () => {
    const instance = {
      'active': true,
      'count': 3,
      'name': 'Alice',
      'score': 95.5
    };
    const quads = Projection.abox(new SchemaGraph(guardSchema), instance, 'https://example.com');

    assert.ok(quads.length > 0, 'should emit at least one abox quad');
    assertAllTermsFullIri(quads, 'Projection.abox');
  });
});
