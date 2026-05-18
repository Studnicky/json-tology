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
import {
  RDF, SH
} from '../../src/constants/IRI.js';
import type { QuadInterface } from '../../src/interfaces/Quad.js';

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
    return obj.value;
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
