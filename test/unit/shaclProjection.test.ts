/**
 * Direct unit tests for ShaclProjection.graph().
 *
 * ShaclProjection.graph() takes a SchemaGraphInterface and returns an array
 * of quads (QuadInterface[]). We drive it with real SchemaGraph instances
 * and assert on quad subjects, predicates, and object values to confirm
 * the SHACL vocabulary projection is correct.
 *
 * IRI constants match the short curie form used by the SH/RDF namespaces
 * from src/constants/IRI.ts.
 */

import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';
import { SchemaGraph } from '../../src/modules/graph/SchemaGraph.js';
import { ShaclProjection } from '../../src/modules/rdf/ShaclProjection.js';
import { decodeLiteral } from '../../src/modules/quads/Terms.js';
import {
  RDF, SH
} from '../../src/constants/IRI.js';
import { Compose } from '../../src/index.js';
import type { QuadInterface } from '../../src/interfaces/QuadInterface.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function project(schema: Record<string, unknown>): QuadInterface[] {
  return ShaclProjection.graph(new SchemaGraph(schema));
}

function filterByPredicate(quads: QuadInterface[], predicate: string): QuadInterface[] {
  return quads.filter((quad) => {
    return quad.predicate.value === predicate;
  });
}

function filterBySubject(quads: QuadInterface[], subject: string): QuadInterface[] {
  return quads.filter((quad) => {
    return quad.subject.value === subject;
  });
}

function objectNamedNodeValue(quad: QuadInterface): string | undefined {
  const obj = quad.object;

  if (obj.termType === 'NamedNode') {
    return obj.value;
  }

  return undefined;
}

function objectLiteralValue(quad: QuadInterface): unknown {
  const obj = quad.object;

  if (obj.termType === 'Literal') {
    return decodeLiteral(obj);
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

void describe('ShaclProjection.graph()', { 'concurrency': true }, () => {
  void it('emits sh:NodeShape for a root object schema with $id', () => {
    const schema = {
      '$id': 'https://example.io/User',
      'type': 'object'
    } as const;

    const quads = project(schema);
    const nodeShapeQuads = quads.filter((quad) => {
      return quad.subject.value === schema.$id
        && quad.predicate.value === RDF.type
        && objectNamedNodeValue(quad) === SH.NodeShape;
    });

    assert.ok(nodeShapeQuads.length > 0, 'root object schema should produce sh:NodeShape quad');
  });

  void it('emits sh:property for each property of a class', () => {
    const schema = {
      '$id': 'https://example.io/Product',
      'properties': {
        'name': { 'type': 'string' },
        'price': { 'type': 'number' }
      },
      'type': 'object'
    } as const;

    const quads = project(schema);
    const propQuads = filterBySubject(quads, schema.$id).filter((quad) => {
      return quad.predicate.value === SH.property;
    });

    assert.equal(propQuads.length, 2, 'should emit sh:property for each declared property');
  });

  void it('emits sh:datatype on property shape for string property', () => {
    const schema = {
      '$id': 'https://example.io/Article',
      'properties': { 'title': { 'type': 'string' } },
      'type': 'object'
    } as const;

    const quads = project(schema);
    const dtQuads = filterByPredicate(quads, SH.datatype);

    assert.ok(dtQuads.length > 0, 'string property should produce sh:datatype quad');
    const hasXsdString = dtQuads.some((quad) => {
      const iri = objectNamedNodeValue(quad);

      return typeof iri === 'string' && iri.includes('string');
    });

    assert.ok(hasXsdString, 'sh:datatype should reference xsd:string');
  });

  void it('emits sh:minCount 1 for required property', () => {
    const schema = {
      '$id': 'https://example.io/Task',
      'properties': {
        'desc': { 'type': 'string' },
        'name': { 'type': 'string' }
      },
      'required': ['name'],
      'type': 'object'
    } as const;

    const quads = project(schema);
    const minCountQuads = filterByPredicate(quads, SH.minCount);

    assert.ok(minCountQuads.length > 0, 'required property should produce sh:minCount quad');
    const hasMin1 = minCountQuads.some((quad) => {
      return objectLiteralValue(quad) === 1;
    });

    assert.ok(hasMin1, 'sh:minCount should be 1 for required field');
  });

  void it('emits sh:maxCount 1 for non-array scalar property', () => {
    const schema = {
      '$id': 'https://example.io/Doc',
      'properties': { 'slug': { 'type': 'string' } },
      'type': 'object'
    } as const;

    const quads = project(schema);
    const maxCountQuads = filterByPredicate(quads, SH.maxCount);

    assert.ok(maxCountQuads.length > 0, 'non-array scalar property should produce sh:maxCount 1 quad');
    const hasMax1 = maxCountQuads.some((quad) => {
      return objectLiteralValue(quad) === 1;
    });

    assert.ok(hasMax1, 'sh:maxCount should be 1 for scalar property');
  });

  void it('emits sh:in for enum values', () => {
    const schema = {
      '$id': 'https://example.io/Status',
      'enum': [
        'active',
        'inactive',
        'pending'
      ],
      'type': 'string'
    } as const;

    const quads = project(schema);
    const inQuads = filterByPredicate(quads, SH.in);

    assert.ok(inQuads.length > 0, 'enum schema should produce sh:in quad');
  });

  void it('emits sh:node for $ref typed property', () => {
    const schema = {
      '$id': 'https://example.io/Order',
      'properties': { 'customer': { '$ref': 'https://example.io/Customer' } },
      'type': 'object'
    } as const;

    const quads = project(schema);
    const nodeQuads = filterByPredicate(quads, SH.node);

    assert.ok(nodeQuads.length > 0, '$ref property should produce sh:node quad');
    const refTarget = nodeQuads.some((quad) => {
      const iri = objectNamedNodeValue(quad);

      return typeof iri === 'string' && iri.includes('Customer');
    });

    assert.ok(refTarget, 'sh:node should reference the $ref target IRI');
  });

  void it('emits sh:closed for object schema with additionalProperties: false', () => {
    const schema = {
      '$id': 'https://example.io/Strict',
      'additionalProperties': false,
      'properties': { 'x': { 'type': 'string' } },
      'type': 'object'
    } as const;

    const quads = project(schema);
    const closedQuads = filterByPredicate(quads, SH.closed);

    assert.ok(closedQuads.length > 0, 'additionalProperties: false should produce sh:closed quad');
    const isTrue = closedQuads.some((quad) => {
      return objectLiteralValue(quad) === true;
    });

    assert.ok(isTrue, 'sh:closed value should be true');
  });

  void it('emits sh:and with subClassOf IRIs for allOf schema', () => {
    const schema = {
      '$id': 'https://example.io/Employee',
      'allOf': [{ '$ref': 'https://example.io/Person' }],
      'type': 'object'
    } as const;

    const quads = project(schema);
    const andQuads = filterByPredicate(quads, SH.and);

    assert.ok(andQuads.length > 0, 'allOf should produce sh:and quad');
  });

  void it('does not throw for boolean false schema (always-fail)', () => {
    const graph = new SchemaGraph(false);

    assert.doesNotThrow(() => {
      ShaclProjection.graph(graph);
    });
  });
});

// ---------------------------------------------------------------------------
// Regression: user-declared restriction projection (Wave 5b correctness fixes)
//
// Both suites pin the CORRECTED SHACL output. They fail against the pre-fix
// projection:
//   - Fix 1 (someValuesFrom guard): the pre-fix `contains` filter matched any
//     restriction structure whose constraint was owl:someValuesFrom, including
//     USER restrictions carried on rdfs:subClassOf. That emitted a spurious
//     sh:qualifiedValueShape. The guard `rel.predicate === OWL.someValuesFrom`
//     restricts matching to the `contains` keyword path. Pre-fix: 1
//     qualifiedValueShape quad; post-fix: 0.
//   - Fix 2 (subClassOf restriction emission): the pre-fix sh:and walk pushed
//     every subClassOf target as a plain IRI, silently dropping the
//     restriction-structured relations (min/maxCardinality user restrictions).
//     Post-fix they emit sh:PropertyShape bnodes with sh:minCount / sh:maxCount.
//     Pre-fix: no sh:maxCount 5 / sh:minCount 1 from the restriction; post-fix:
//     both present.
// ---------------------------------------------------------------------------

void describe('ShaclProjection.graph() — user restriction regression', { 'concurrency': true }, () => {
  void it('emits NO sh:qualifiedValueShape for a user someValuesFrom restriction (Fix 1)', () => {
    // A user-declared someValuesFrom restriction is carried on rdfs:subClassOf,
    // NOT on the owl:someValuesFrom `contains` predicate. SHACL must not treat it
    // as a `contains` qualified-value-shape. Pre-fix this emitted 1 spurious quad.
    const schema = Compose.subClassOf(
      Compose.someValuesFrom('urn:example:Shelf#books', 'urn:example:Book'),
      {
        '$id': 'urn:example:Shelf',
        'properties': { 'books': { '$ref': 'urn:example:Book' } },
        'type': 'object'
      }
    ) as Record<string, unknown>;

    const quads = project(schema);
    const qvsQuads = filterByPredicate(quads, SH.qualifiedValueShape);

    assert.equal(
      qvsQuads.length,
      0,
      'a user someValuesFrom restriction must not emit a sh:qualifiedValueShape'
    );
  });

  void it('emits sh:PropertyShape with sh:minCount 1 and sh:maxCount 5 for user cardinality restrictions (Fix 2)', () => {
    // Two stacked user restrictions: minCardinality 1 and maxCardinality 5 on the
    // same property. Pre-fix these restriction-structured subClassOf relations were
    // silently dropped from the sh:and walk; post-fix they become sh:PropertyShape
    // constraints with sh:minCount / sh:maxCount.
    const schema = Compose.subClassOf(
      Compose.minCardinality('urn:example:Book#authors', 1),
      Compose.subClassOf(
        Compose.maxCardinality('urn:example:Book#authors', 5),
        {
          '$id': 'urn:example:Book',
          'properties': { 'authors': { 'type': 'string' } },
          'type': 'object'
        }
      )
    ) as Record<string, unknown>;

    const quads = project(schema);

    // sh:and must be emitted to carry the restriction property shapes.
    const andQuads = filterByPredicate(quads, SH.and);

    assert.equal(andQuads.length, 1, 'the class node must carry one sh:and for its restrictions');

    // The PropertyShapes emitted from the restrictions must carry sh:path on the
    // restricted property and the correct min/max counts.
    const restrictionPropertyShapes = quads.filter((quad) => {
      return quad.predicate.value === SH.path
        && objectNamedNodeValue(quad) === 'urn:example:Book#authors';
    });

    assert.ok(
      restrictionPropertyShapes.length >= 2,
      'min and max cardinality restrictions each produce a sh:path on the property'
    );

    // sh:minCount 1 from the minCardinality restriction.
    const minCountValues = filterByPredicate(quads, SH.minCount).map((quad) => {
      return objectLiteralValue(quad);
    });

    assert.ok(
      minCountValues.includes(1),
      'minCardinality 1 restriction must emit sh:minCount 1'
    );

    // sh:maxCount 5 from the maxCardinality restriction (distinct from the scalar
    // property shape's sh:maxCount 1).
    const maxCountValues = filterByPredicate(quads, SH.maxCount).map((quad) => {
      return objectLiteralValue(quad);
    });

    assert.ok(
      maxCountValues.includes(5),
      'maxCardinality 5 restriction must emit sh:maxCount 5'
    );
  });
});
