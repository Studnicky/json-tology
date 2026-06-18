/**
 * End-to-end enforcement tests for OWL individual assertion invariants.
 *
 * Tests NPA (Fix A), differentFrom identity consistency (Fix B), and
 * hasKey well-formedness (Fix C) through the public JsonTology facade.
 *
 * No invariant fn() is called directly — all assertions go through
 * jt.validate() / jt.fromTbox() / registry stores.
 */

import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';
import type { QuadInterface } from '../../src/interfaces/QuadInterface.js';
import { JsonTology } from '../../src/index.js';
import { SchemaError } from '../../src/errors/SchemaError.js';
import { Terms } from '../../src/modules/quads/Terms.js';
import { listQuad } from '../helpers/listQuad.js';

const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const OWL_NS = 'http://www.w3.org/2002/07/owl#';
const OWL_CLASS = `${OWL_NS}Class`;
const OWL_NAMED_INDIVIDUAL = `${OWL_NS}NamedIndividual`;
const OWL_SAME_AS = `${OWL_NS}sameAs`;
const OWL_DIFFERENT_FROM = `${OWL_NS}differentFrom`;
const OWL_NPA = `${OWL_NS}NegativePropertyAssertion`;
const OWL_SOURCE_INDIVIDUAL = `${OWL_NS}sourceIndividual`;
const OWL_ASSERTION_PROPERTY = `${OWL_NS}assertionProperty`;
const OWL_TARGET_VALUE = `${OWL_NS}targetValue`;
const OWL_OBJECT_PROPERTY = `${OWL_NS}ObjectProperty`;
const OWL_HAS_KEY = `${OWL_NS}hasKey`;

function tripleQuad(subject: string, predicate: string, object: string): QuadInterface {
  return Terms.quad(Terms.iri(subject), Terms.iri(predicate), Terms.iri(object));
}

// ---------------------------------------------------------------------------
// Fix A — NegativePropertyAssertion enforced via class-keyed invariant
// ---------------------------------------------------------------------------

void describe('Fix A — NegativePropertyAssertion end-to-end', () => {
  const classC = 'urn:test:Person';
  const individualI = 'urn:test:alice';
  const propP = 'urn:test:status';
  const forbiddenV = 'banned';

  const quads: QuadInterface[] = [
    tripleQuad(classC, RDF_TYPE, OWL_CLASS),
    tripleQuad(propP, RDF_TYPE, OWL_OBJECT_PROPERTY),
    tripleQuad(individualI, RDF_TYPE, OWL_NAMED_INDIVIDUAL),
    tripleQuad(individualI, RDF_TYPE, classC),
    Terms.quad(Terms.blank('npa1'), Terms.iri(RDF_TYPE), Terms.iri(OWL_NPA)),
    Terms.quad(Terms.blank('npa1'), Terms.iri(OWL_SOURCE_INDIVIDUAL), Terms.iri(individualI)),
    Terms.quad(Terms.blank('npa1'), Terms.iri(OWL_ASSERTION_PROPERTY), Terms.iri(propP)),
    Terms.quad(Terms.blank('npa1'), Terms.iri(OWL_TARGET_VALUE), Terms.literal(forbiddenV))
  ];

  void it('fromTbox with register:true wires NPA invariant to class schema', () => {
    const jt = JsonTology.create({
      'baseIRI': 'urn:test',
      'enableStrictGraph': false
    });
    const result = jt.fromTbox(quads, { 'register': true });

    assert.ok(jt.registry.has(classC), 'class C is registered');
    const inv = result.invariants.find((entry) => {
      return entry.schemaId === classC;
    });

    assert.ok(inv, 'NPA invariant is keyed to class C');
  });

  void it('validate(C, { $id: i, p: forbiddenV }) reports invariant error', () => {
    const jt = JsonTology.create({
      'baseIRI': 'urn:test',
      'enableStrictGraph': false
    });

    jt.fromTbox(quads, { 'register': true });

    const errors = jt.validate(classC, {
      '$id': individualI,
      [propP]: forbiddenV
    });

    assert.ok(errors.length > 0, 'should report invariant violation');
    const msgs = errors.items.map((err) => {
      return err.message;
    });

    assert.ok(msgs.some((msg) => {
      return msg.includes('NegativePropertyAssertion') || msg.includes(propP);
    }), 'error mentions NPA context');
  });

  void it('validate(C, { $id: i, p: otherValue }) passes', () => {
    const jt = JsonTology.create({
      'baseIRI': 'urn:test',
      'enableStrictGraph': false
    });

    jt.fromTbox(quads, { 'register': true });

    const errors = jt.validate(classC, {
      '$id': individualI,
      [propP]: 'active'
    });

    assert.equal(errors.length, 0, 'different value should pass');
  });

  void it('validate(C, { $id: differentIndividual, p: forbiddenV }) passes (identity guard)', () => {
    const jt = JsonTology.create({
      'baseIRI': 'urn:test',
      'enableStrictGraph': false
    });

    jt.fromTbox(quads, { 'register': true });

    const errors = jt.validate(classC, {
      '$id': 'urn:test:bob',
      [propP]: forbiddenV
    });

    assert.equal(errors.length, 0, 'different individual with forbidden value should pass (identity guard)');
  });
});

// ---------------------------------------------------------------------------
// Fix B — differentFrom identity consistency check
// ---------------------------------------------------------------------------

void describe('Fix B — differentFrom identity consistency end-to-end', () => {
  const iriA = 'urn:test:alice';
  const iriB = 'urn:test:bob';

  void it('consistent import (differentFrom only, no unifying sameAs) does not throw', () => {
    const diffQuads: QuadInterface[] = [tripleQuad(iriA, OWL_DIFFERENT_FROM, iriB)];
    const jt = JsonTology.create({
      'baseIRI': 'urn:test',
      'enableStrictGraph': false
    });

    assert.doesNotThrow(() => {
      jt.fromTbox(diffQuads, { 'register': true });
    }, 'consistent import must not throw');

    assert.ok(jt.registry.differentFromStore.has(iriA, iriB), 'pair recorded in differentFromStore');
  });

  void it('contradictory import (differentFrom + sameAs for same pair) throws SCHEMA_IDENTITY_CONTRADICTION', () => {
    const contradictoryQuads: QuadInterface[] = [
      tripleQuad(iriA, OWL_DIFFERENT_FROM, iriB),
      tripleQuad(iriA, OWL_SAME_AS, iriB)
    ];
    const jt = JsonTology.create({
      'baseIRI': 'urn:test',
      'enableStrictGraph': false
    });

    assert.throws(
      () => {
        jt.fromTbox(contradictoryQuads, { 'register': true });
      },
      (err: unknown) => {
        assert.ok(err instanceof SchemaError, 'must be SchemaError');
        assert.equal(err.code, 'SCHEMA_IDENTITY_CONTRADICTION', 'must carry IDENTITY_CONTRADICTION code');

        return true;
      }
    );
  });
});

// ---------------------------------------------------------------------------
// Fix C — hasKey well-formedness per-object
// ---------------------------------------------------------------------------

void describe('Fix C — hasKey well-formedness end-to-end', () => {
  const classC = 'urn:test:Book';
  const propK = 'urn:test:isbn';

  const keyQuads: QuadInterface[] = [
    tripleQuad(classC, RDF_TYPE, OWL_CLASS),
    tripleQuad(propK, RDF_TYPE, OWL_OBJECT_PROPERTY),
    ...listQuad(Terms.iri(classC), Terms.iri(OWL_HAS_KEY), [Terms.iri(propK)])
  ];

  void it('validate(C, { isbn: "scalar" }) passes well-formedness', () => {
    const jt = JsonTology.create({
      'baseIRI': 'urn:test',
      'enableStrictGraph': false
    });

    jt.fromTbox(keyQuads, { 'register': true });

    const errors = jt.validate(classC, { [propK]: '978-3-16-148410-0' });

    assert.equal(errors.length, 0, 'scalar key property should pass');
  });

  void it('validate(C, { isbn: ["array","value"] }) reports well-formedness invariant error', () => {
    const jt = JsonTology.create({
      'baseIRI': 'urn:test',
      'enableStrictGraph': false
    });

    jt.fromTbox(keyQuads, { 'register': true });

    const errors = jt.validate(classC, {
      [propK]: [
        '978-invalid',
        'array-value'
      ]
    });

    assert.ok(errors.length > 0, 'array-valued key property should fail well-formedness check');
    const msgs = errors.items.map((err) => {
      return err.message;
    });

    assert.ok(msgs.some((msg) => {
      return msg.includes('hasKey') || msg.includes(propK);
    }), 'error mentions hasKey context');
  });

  void it('validate(C, { isbn: 12345 }) passes (numeric scalar)', () => {
    const jt = JsonTology.create({
      'baseIRI': 'urn:test',
      'enableStrictGraph': false
    });

    jt.fromTbox(keyQuads, { 'register': true });

    const errors = jt.validate(classC, { [propK]: 12_345 });

    assert.equal(errors.length, 0, 'numeric scalar key property should pass');
  });
});
