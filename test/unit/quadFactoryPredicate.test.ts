/**
 * QuadFactory — predicate finalization validation (F2-A).
 *
 * A predicate supplied as a compact CURIE (`prefix:local`) is expanded against
 * the active Curie instance before becoming a NamedNode. When the prefix is not
 * registered, Curie.expand returns the value verbatim, leaving a still-compact
 * string that would otherwise be emitted as an invalid IRI. QuadFactory rejects
 * such a finalized predicate (GraphError INVALID_PREDICATE_IRI) rather than
 * producing a malformed quad. Registered prefixes and absolute IRIs pass.
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { QuadFactory } from '../../src/modules/rdf/QuadFactory.js';
import { Curie } from '../../src/modules/rdf/Curie.js';
import { Terms } from '../../src/modules/rdf/Terms.js';
import { XSD } from '../../src/constants/IRI.js';

const SUBJECT = 'https://example.com/subject';
const OBJECT = Terms.literal('value', { 'datatype': Terms.iri(XSD.string) });

void describe('QuadFactory.quad — predicate CURIE expansion (F2-A)', { 'concurrency': true }, () => {
  void it('throws when an unregistered-prefix CURIE predicate cannot expand to an absolute IRI', () => {
    const curie = new Curie({ 'ex': 'https://example.com/' });

    assert.throws(
      () => {
        QuadFactory.quad(SUBJECT, 'unregistered:title', OBJECT, { curie });
      },
      /INVALID_PREDICATE_IRI|not an absolute IRI/u,
      'unregistered CURIE prefix predicate rejected'
    );
  });

  void it('expands a registered-prefix CURIE predicate to an absolute IRI', () => {
    const curie = new Curie({ 'ex': 'https://example.com/' });
    const quad = QuadFactory.quad(SUBJECT, 'ex:title', OBJECT, { curie });

    assert.equal(quad.predicate.value, 'https://example.com/title', 'registered prefix expands');
  });

  void it('accepts an already-absolute http(s) predicate IRI', () => {
    const quad = QuadFactory.quad(SUBJECT, 'https://example.com/title', OBJECT);

    assert.equal(quad.predicate.value, 'https://example.com/title', 'absolute IRI passes through');
  });

  void it('accepts a urn: namespace predicate', () => {
    const quad = QuadFactory.quad(SUBJECT, 'urn:example:title', OBJECT);

    assert.equal(quad.predicate.value, 'urn:example:title', 'urn predicate passes through');
  });

  void it('throws on a tripleTerm predicate that stays compact after expansion', () => {
    const curie = new Curie({ 'ex': 'https://example.com/' });

    assert.throws(
      () => {
        QuadFactory.tripleTerm(SUBJECT, 'unregistered:edge', OBJECT, { curie });
      },
      /INVALID_PREDICATE_IRI|not an absolute IRI/u,
      'unresolved CURIE triple-term predicate rejected'
    );
  });
});
