/**
 * Unit tests for JsonTology.toTbox() and JsonTology.toShacl()
 *
 * Verifies that toTbox() returns OWL-only output, toShacl() returns SHACL-only
 * output, and that both are uncached (each call returns a fresh OntologyBuilder).
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';

import { bookstoreJt } from '../../examples/docs/bookstore/index.js';

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
    const builder = bookstoreJt.toTbox();
    const raw = builder.raw();

    assert.ok(raw.length > 0, 'toTbox() raw quads must be non-empty');
  });

  await it('raw output contains owl:Class declarations', () => {
    const builder = bookstoreJt.toTbox();
    const raw = builder.raw();

    assert.ok(
      hasType(raw, OWL_CLASS_IRI),
      `Expected at least one node with @type '${OWL_CLASS_IRI}'`
    );
  });

  await it('raw output contains OWL property declarations (DatatypeProperty or ObjectProperty)', () => {
    const builder = bookstoreJt.toTbox();
    const raw = builder.raw();

    const hasDatatype = hasType(raw, OWL_DATATYPE_PROPERTY_IRI);
    const hasObjectProp = hasType(raw, 'http://www.w3.org/2002/07/owl#ObjectProperty');

    assert.ok(
      hasDatatype || hasObjectProp,
      'Expected at least one OWL property declaration in toTbox() output'
    );
  });

  await it('raw output contains rdfs:domain triples', () => {
    const builder = bookstoreJt.toTbox();
    const raw = builder.raw();

    assert.ok(
      hasPredicate(raw, RDFS_DOMAIN_IRI),
      `Expected at least one node with '${RDFS_DOMAIN_IRI}' predicate`
    );
  });

  await it('raw output does NOT contain sh:NodeShape triples (no SHACL)', () => {
    const builder = bookstoreJt.toTbox();
    const raw = builder.raw();

    assert.ok(
      !hasType(raw, SH_NODE_SHAPE_IRI),
      'toTbox() raw output must not contain sh:NodeShape — SHACL must be absent'
    );
  });

  await it('raw output does NOT contain sh:property triples (no SHACL)', () => {
    const builder = bookstoreJt.toTbox();
    const raw = builder.raw();

    assert.ok(
      !hasPredicate(raw, SH_PROPERTY_IRI),
      'toTbox() raw output must not contain sh:property — SHACL must be absent'
    );
  });

  await it('two calls return different OntologyBuilder instances (not cached)', () => {
    const first = bookstoreJt.toTbox();
    const second = bookstoreJt.toTbox();

    assert.notEqual(first, second, 'toTbox() must return a fresh OntologyBuilder on each call');
  });
});

await describe('JsonTology.toShacl()', async () => {
  await it('returns an OntologyBuilder with non-empty SHACL quads', () => {
    const builder = bookstoreJt.toShacl();
    const shaclObj = builder.shaclObject();
    const graph = shaclObj['@graph'];

    assert.ok(Array.isArray(graph) && graph.length > 0, 'toShacl() shaclObject @graph must be non-empty');
  });

  await it('SHACL output contains sh:NodeShape triples', () => {
    const builder = bookstoreJt.toShacl();
    const shaclObj = builder.shaclObject();
    const graph = shaclObj['@graph'] as unknown[];

    assert.ok(
      hasType(graph, SH_NODE_SHAPE_IRI),
      `Expected at least one node with @type '${SH_NODE_SHAPE_IRI}'`
    );
  });

  await it('SHACL output contains sh:property triples', () => {
    const builder = bookstoreJt.toShacl();
    const shaclObj = builder.shaclObject();
    const graph = shaclObj['@graph'] as unknown[];

    assert.ok(
      hasPredicate(graph, SH_PROPERTY_IRI),
      `Expected at least one node with '${SH_PROPERTY_IRI}' predicate`
    );
  });

  await it('raw OWL output is empty — no owl:Class triples', () => {
    const builder = bookstoreJt.toShacl();
    const raw = builder.raw();

    assert.ok(
      !hasType(raw, OWL_CLASS_IRI),
      'toShacl() raw output must not contain owl:Class — OWL TBox must be absent'
    );
  });

  await it('raw OWL output is empty — no rdfs:domain triples', () => {
    const builder = bookstoreJt.toShacl();
    const raw = builder.raw();

    assert.ok(
      !hasPredicate(raw, RDFS_DOMAIN_IRI),
      'toShacl() raw output must not contain rdfs:domain — OWL TBox must be absent'
    );
  });

  await it('two calls return different OntologyBuilder instances (not cached)', () => {
    const first = bookstoreJt.toShacl();
    const second = bookstoreJt.toShacl();

    assert.notEqual(first, second, 'toShacl() must return a fresh OntologyBuilder on each call');
  });
});

await describe('JsonTology.ontology() regression', async () => {
  await it('returns an OntologyBuilder with owl:Class in raw output', () => {
    const builder = bookstoreJt.ontology();
    const raw = builder.raw();

    assert.ok(
      hasType(raw, OWL_CLASS_IRI),
      'ontology() must still include owl:Class declarations (TBox regression)'
    );
  });

  await it('returns an OntologyBuilder with sh:NodeShape in SHACL output', () => {
    const builder = bookstoreJt.ontology();
    const shaclObj = builder.shaclObject();
    const graph = shaclObj['@graph'] as unknown[];

    assert.ok(
      hasType(graph, SH_NODE_SHAPE_IRI),
      'ontology() must still include sh:NodeShape (SHACL regression)'
    );
  });

  await it('is cached — two calls return the same OntologyBuilder reference', () => {
    const first = bookstoreJt.ontology();
    const second = bookstoreJt.ontology();

    assert.equal(first, second, 'ontology() must return the same cached OntologyBuilder instance');
  });
});
