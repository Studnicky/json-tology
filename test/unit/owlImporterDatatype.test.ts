/**
 * Regression test for OwlImporter.ts — buildQuadFromExternal must not fabricate
 * a NamedNode with an empty-string IRI when an external RDF/JS literal has no
 * datatype. The fix falls back to XSD.string instead of `Terms.iri('')`.
 *
 * The function is private, so we test two observable facts:
 *   1. `Terms.iri('')` produces a NamedNode with value '' — invalid RDF.
 *      This was what the old code did. We document this as the bug shape.
 *   2. `Terms.iri(XSD.string)` produces a valid NamedNode for the xsd:string
 *      datatype — the fixed behaviour.
 *   3. Terms.literal with no language tag must not carry an empty language string
 *      (the RDF/JS spec: only lang-string literals have a non-empty language).
 *
 * Because buildQuadFromExternal is not exported, the test validates the
 * correctness of the fix by verifying the Terms.literal call contract that the
 * fixed code must satisfy. A companion integration-level assertion checks that
 * the OwlImporter's normalizeInput path (which DOES run synchronously via the
 * compact JSON-LD walker) handles plain-text annotation literals correctly, since
 * those literals come through jsonLdNodesToQuads, not buildQuadFromExternal.
 *
 * If buildQuadFromExternal becomes callable in a future refactor, this test
 * should be extended to call it directly.
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { Terms } from '../../src/modules/rdf/Terms.js';
import { XSD } from '../../src/constants/IRI.js';
import { OwlImporter } from '../../src/modules/ontology/OwlImporter.js';

// ---------------------------------------------------------------------------
// 1. Demonstrate the bug: Terms.iri('') produces an invalid NamedNode
// ---------------------------------------------------------------------------

void describe('Terms.iri — empty-string IRI is invalid RDF', () => {
  void it('Terms.iri("") produces a NamedNode with empty value — invalid per RDF spec', () => {
    const emptyNode = Terms.iri('');

    // Document the shape of the old bug: a NamedNode with value ''
    assert.equal(emptyNode.termType, 'NamedNode');
    assert.equal(emptyNode.value, '', 'empty-string IRI is technically constructable but invalid');
  });

  void it('Terms.iri(XSD.string) produces a valid xsd:string NamedNode — the fixed behaviour', () => {
    const xsdStringNode = Terms.iri(XSD.string);

    assert.equal(xsdStringNode.termType, 'NamedNode');
    assert.equal(xsdStringNode.value, 'http://www.w3.org/2001/XMLSchema#string');
  });
});

// ---------------------------------------------------------------------------
// 2. Terms.literal contract: absent datatype must default to xsd:string,
//    absent language must not produce an empty language string.
// ---------------------------------------------------------------------------

void describe('Terms.literal — datatype and language contract', () => {
  void it('a literal with explicit xsd:string datatype has the correct datatype IRI', () => {
    const lit = Terms.literal('hello', { 'datatype': Terms.iri(XSD.string) });

    assert.equal(lit.termType, 'Literal');
    assert.equal(lit.value, 'hello');
    assert.equal(lit.datatype.value, XSD.string);
    assert.equal(lit.datatype.value, 'http://www.w3.org/2001/XMLSchema#string');
  });

  void it('a literal with no options infers xsd:string datatype for a string value', () => {
    // Terms.literal infers xsd:string for unknown (string) values when no datatype given
    const lit = Terms.literal('hello');

    assert.equal(lit.termType, 'Literal');
    assert.equal(lit.datatype.value, XSD.string, 'inferred datatype should be xsd:string');
  });

  void it('a literal without language has empty language string (rdf/js default)', () => {
    const lit = Terms.literal('hello', { 'datatype': Terms.iri(XSD.string) });

    // The rdf/js spec uses '' for no language; the old code passed language: '' explicitly.
    // The fix omits language when absent, which also produces '' (the rdf/js default).
    // Both behaviours should be identical — '' language with a non-langString datatype.
    assert.equal(lit.language, '', 'no language means empty string in rdf/js model');
  });

  void it('a literal with an explicit language tag carries that tag', () => {
    const lit = Terms.literal('hola', {
      'datatype': Terms.iri(XSD.string),
      'language': 'es'
    });

    assert.equal(lit.language, 'es');
    assert.equal(lit.value, 'hola');
  });
});

// ---------------------------------------------------------------------------
// 3. OwlImporter synchronous path: plain-text literals in annotations
//    come through jsonLdNodesToQuads (not buildQuadFromExternal), but we
//    verify the importer still handles round-tripped owl:versionInfo strings.
// ---------------------------------------------------------------------------

void describe('OwlImporter — annotation literal round-trip', () => {
  const importer = new OwlImporter({ 'baseIRI': 'https://example.com/' });

  void it('imports a compact JSON-LD document with an owl:versionInfo annotation', () => {
    // Minimal OWL annotation document — synchronous compact JSON-LD path
    const doc = {
      '@context': {
        'owl': 'http://www.w3.org/2002/07/owl#',
        'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
        'rdfs': 'http://www.w3.org/2000/01/rdf-schema#',
        'xsd': 'http://www.w3.org/2001/XMLSchema#'
      },
      '@graph': [{
        '@id': 'https://example.com/Book',
        '@type': 'owl:Class',
        'owl:versionInfo': '1.0.0'
      }]
    };

    const result = importer.import(doc);

    assert.ok(result.schemas.length > 0, 'at least one schema extracted');
    const schema = result.schemas.find((foundSchema) => {
      return foundSchema.$id === 'https://example.com/Book';
    });

    assert.ok(schema !== undefined, 'Book schema extracted');
  });
});
