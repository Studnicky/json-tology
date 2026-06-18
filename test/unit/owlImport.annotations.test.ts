/**
 * Unit tests for the Annotations dispatcher (importAnnotations).
 *
 * Covers:
 *   - rdfs:label → title (plain, language-tagged)
 *   - rdfs:comment → description (plain, language-tagged, multi-value)
 *   - owl:deprecated → deprecated: true
 *   - owl:versionInfo → $comment "version: ..."
 *   - rdfs:isDefinedBy → $comment "definedBy: <iri>"
 *   - rdfs:seeAlso → $comment "seeAlso: <iri>"
 *   - skos:prefLabel → title
 *   - skos:definition → description
 *   - Language-tagged annotations: English preferred; i18n record emitted for multiple tags
 *   - Multi-valued annotations: joined with '\n\n'
 *   - Empty quad input → empty schemaDeltas
 *   - Unrelated predicates → silently skipped, no schemaDeltas
 *   - Bookstore round-trip: description on AuthorName survives title/description annotation import
 */

import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';
import { Annotations } from '../../src/modules/ontology/importDispatch/Annotations.js';
import { Curie } from '../../src/modules/quads/Curie.js';
import { STANDARD_PREFIXES } from '../../src/constants/STANDARD_PREFIXES.js';
import { Terms } from '../../src/modules/quads/Terms.js';
import { SchemaGraph } from '../../src/modules/graph/SchemaGraph.js';
import type { QuadInterface } from '../../src/interfaces/QuadInterface.js';
import type {
  OwlImportContextType, OwlImportFragmentType
} from '../../src/types/OwlImport.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const curie = new Curie(STANDARD_PREFIXES);

function makeCtx(quads: QuadInterface[] = []): OwlImportContextType & { 'unsupportedLog': Array<{ 'axiomIri': string;
  'subjectIri': null | string }> } {
  const unsupportedLog: Array<{ 'axiomIri': string;
    'subjectIri': null | string }> = [];

  return {
    'allClassIris': new Set(),
    'allPropertyIris': new Set(),
    'baseIRI': 'https://example.com/',
    curie,
    'graph': SchemaGraph.fromQuads(quads, {
      'baseIRI': 'https://example.com/',
      'prefixes': STANDARD_PREFIXES
    }),
    'isDatatype': () => {
      return false;
    },
    'prefixes': STANDARD_PREFIXES,
    'reportUnsupported': (axiomIri, subjectIri) => {
      unsupportedLog.push({
        axiomIri,
        subjectIri
      });
    },
    unsupportedLog
  };
}

/** Run the Annotations dispatcher with a graph derived from the same quads. */
function runAnnotations(quads: QuadInterface[]): OwlImportFragmentType {
  return Annotations.dispatch(quads, makeCtx(quads));
}

// ---------------------------------------------------------------------------
// Quad builders — use full IRIs (as JsonLdToQuads.ts expands them)
// ---------------------------------------------------------------------------

const RDFS_LABEL = 'http://www.w3.org/2000/01/rdf-schema#label';
const RDFS_COMMENT = 'http://www.w3.org/2000/01/rdf-schema#comment';
const OWL_DEPRECATED = 'http://www.w3.org/2002/07/owl#deprecated';
const OWL_VERSION_INFO = 'http://www.w3.org/2002/07/owl#versionInfo';
const RDFS_IS_DEFINED_BY = 'http://www.w3.org/2000/01/rdf-schema#isDefinedBy';
const RDFS_SEE_ALSO = 'http://www.w3.org/2000/01/rdf-schema#seeAlso';
const SKOS_PREF_LABEL = 'http://www.w3.org/2004/02/skos/core#prefLabel';
const SKOS_DEFINITION = 'http://www.w3.org/2004/02/skos/core#definition';
const SKOS_ALT_LABEL = 'http://www.w3.org/2004/02/skos/core#altLabel';
const XSD_STRING = 'http://www.w3.org/2001/XMLSchema#string';
const XSD_BOOLEAN = 'http://www.w3.org/2001/XMLSchema#boolean';

function makeLiteralQuad(subject: string, predicate: string, value: unknown, lang = ''): QuadInterface {
  return Terms.quad(
    Terms.iri(subject),
    Terms.iri(predicate),
    Terms.literal(value, {
      'datatype': Terms.iri(XSD_STRING),
      'language': lang
    })
  );
}

function makeBooleanLiteralQuad(subject: string, predicate: string, value: boolean): QuadInterface {
  return Terms.quad(
    Terms.iri(subject),
    Terms.iri(predicate),
    Terms.literal(value, { 'datatype': Terms.iri(XSD_BOOLEAN) })
  );
}

function makeIriQuad(subject: string, predicate: string, objectIri: string): QuadInterface {
  return Terms.quad(
    Terms.iri(subject),
    Terms.iri(predicate),
    Terms.iri(objectIri)
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

void describe('importAnnotations', { 'concurrency': true }, () => {
  // ── Empty input ──────────────────────────────────────────────────────────

  void it('returns an empty fragment for an empty quad array', () => {
    const fragment = runAnnotations([]);

    assert.strictEqual(fragment.schemaDeltas.size, 0);
    assert.deepEqual(fragment.characteristics, []);
    assert.deepEqual(fragment.invariants, []);
    assert.deepEqual(fragment.sameAs, []);
    assert.deepEqual(fragment.individuals, []);
  });

  // ── rdfs:label → title ───────────────────────────────────────────────────

  void it('maps rdfs:label to title', () => {
    const subject = 'https://example.com/Person';
    const quads: QuadInterface[] = [makeLiteralQuad(subject, RDFS_LABEL, 'Person')];
    const fragment = runAnnotations(quads);
    const delta = fragment.schemaDeltas.get(subject);

    assert.ok(delta !== undefined, 'delta must be present');
    assert.strictEqual(delta.title, 'Person');
  });

  void it('maps rdfs:label with compact CURIE predicate to title', () => {
    const subject = 'https://example.com/Book';
    // Compact CURIE form (as stored in IRI.ts constants)
    const quads: QuadInterface[] = [makeLiteralQuad(subject, 'rdfs:label', 'Book')];
    const fragment = runAnnotations(quads);
    const delta = fragment.schemaDeltas.get(subject);

    assert.ok(delta !== undefined, 'delta must be present for compact CURIE predicate');
    assert.strictEqual(delta.title, 'Book');
  });

  // ── rdfs:comment → description ───────────────────────────────────────────

  void it('maps rdfs:comment to description', () => {
    const subject = 'https://example.com/Person';
    const quads: QuadInterface[] = [makeLiteralQuad(subject, RDFS_COMMENT, 'A human person.')];
    const fragment = runAnnotations(quads);
    const delta = fragment.schemaDeltas.get(subject);

    assert.ok(delta !== undefined);
    assert.strictEqual(delta.description, 'A human person.');
  });

  void it('concatenates multiple rdfs:comment values with \\n\\n', () => {
    const subject = 'https://example.com/Book';
    const quads: QuadInterface[] = [
      makeLiteralQuad(subject, RDFS_COMMENT, 'First comment.'),
      makeLiteralQuad(subject, RDFS_COMMENT, 'Second comment.')
    ];
    const fragment = runAnnotations(quads);
    const delta = fragment.schemaDeltas.get(subject);

    assert.ok(delta !== undefined);
    assert.strictEqual(delta.description, 'First comment.\n\nSecond comment.');
  });

  // ── owl:deprecated → deprecated ──────────────────────────────────────────

  void it('maps owl:deprecated true to deprecated: true', () => {
    const subject = 'https://example.com/OldClass';
    const quads: QuadInterface[] = [makeBooleanLiteralQuad(subject, OWL_DEPRECATED, true)];
    const fragment = runAnnotations(quads);
    const delta = fragment.schemaDeltas.get(subject);

    assert.ok(delta !== undefined);
    assert.strictEqual(delta.deprecated, true);
  });

  void it('maps owl:deprecated "true" string literal to deprecated: true', () => {
    const subject = 'https://example.com/OldClass';
    const quads: QuadInterface[] = [makeLiteralQuad(subject, OWL_DEPRECATED, 'true')];
    const fragment = runAnnotations(quads);
    const delta = fragment.schemaDeltas.get(subject);

    assert.ok(delta !== undefined);
    assert.strictEqual(delta.deprecated, true);
  });

  void it('does not emit deprecated for owl:deprecated false', () => {
    const subject = 'https://example.com/ActiveClass';
    const quads: QuadInterface[] = [makeBooleanLiteralQuad(subject, OWL_DEPRECATED, false)];
    const fragment = runAnnotations(quads);

    // Should produce no delta (deprecated: false is the default and need not be stored)
    const delta = fragment.schemaDeltas.get(subject);

    assert.ok(delta?.deprecated !== true, 'deprecated must not be true for owl:deprecated false');
  });

  // ── owl:versionInfo → $comment ───────────────────────────────────────────

  void it('maps owl:versionInfo to $comment "version: ..."', () => {
    const subject = 'https://example.com/Ontology';
    const quads: QuadInterface[] = [makeLiteralQuad(subject, OWL_VERSION_INFO, '1.2.3')];
    const fragment = runAnnotations(quads);
    const delta = fragment.schemaDeltas.get(subject);

    assert.ok(delta !== undefined);
    assert.ok(typeof delta.$comment === 'string' && delta.$comment.includes('version: 1.2.3'), `$comment must include "version: 1.2.3", got: ${delta.$comment}`);
  });

  // ── rdfs:isDefinedBy → $comment ──────────────────────────────────────────

  void it('maps rdfs:isDefinedBy to $comment "definedBy: ..."', () => {
    const subject = 'https://example.com/Person';
    const ontologyIri = 'https://example.com/ontology';
    const quads: QuadInterface[] = [makeIriQuad(subject, RDFS_IS_DEFINED_BY, ontologyIri)];
    const fragment = runAnnotations(quads);
    const delta = fragment.schemaDeltas.get(subject);

    assert.ok(delta !== undefined);
    assert.ok(
      typeof delta.$comment === 'string' && delta.$comment.includes(`definedBy: ${ontologyIri}`),
      `$comment must include "definedBy: ${ontologyIri}", got: ${delta.$comment}`
    );
  });

  // ── rdfs:seeAlso → $comment ──────────────────────────────────────────────

  void it('maps rdfs:seeAlso to $comment "seeAlso: ..."', () => {
    const subject = 'https://example.com/Book';
    const refIri = 'https://schema.org/Book';
    const quads: QuadInterface[] = [makeIriQuad(subject, RDFS_SEE_ALSO, refIri)];
    const fragment = runAnnotations(quads);
    const delta = fragment.schemaDeltas.get(subject);

    assert.ok(delta !== undefined);
    assert.ok(
      typeof delta.$comment === 'string' && delta.$comment.includes(`seeAlso: ${refIri}`),
      `$comment must include "seeAlso: ${refIri}", got: ${delta.$comment}`
    );
  });

  // ── skos:prefLabel → title ────────────────────────────────────────────────

  void it('maps skos:prefLabel to title', () => {
    const subject = 'https://example.com/Concept';
    const quads: QuadInterface[] = [makeLiteralQuad(subject, SKOS_PREF_LABEL, 'My Concept')];
    const fragment = runAnnotations(quads);
    const delta = fragment.schemaDeltas.get(subject);

    assert.ok(delta !== undefined);
    assert.strictEqual(delta.title, 'My Concept');
  });

  // ── skos:definition → description ────────────────────────────────────────

  void it('maps skos:definition to description', () => {
    const subject = 'https://example.com/Concept';
    const quads: QuadInterface[] = [makeLiteralQuad(subject, SKOS_DEFINITION, 'A detailed definition.')];
    const fragment = runAnnotations(quads);
    const delta = fragment.schemaDeltas.get(subject);

    assert.ok(delta !== undefined);
    assert.strictEqual(delta.description, 'A detailed definition.');
  });

  // ── Language tags ─────────────────────────────────────────────────────────

  void it('prefers English language-tagged rdfs:label over other languages', () => {
    const subject = 'https://example.com/Person';
    const quads: QuadInterface[] = [
      makeLiteralQuad(subject, RDFS_LABEL, 'Personne', 'fr'),
      makeLiteralQuad(subject, RDFS_LABEL, 'Person', 'en'),
      makeLiteralQuad(subject, RDFS_LABEL, 'Person', 'de')
    ];
    const fragment = runAnnotations(quads);
    const delta = fragment.schemaDeltas.get(subject);

    assert.ok(delta !== undefined);
    assert.strictEqual(delta.title, 'Person');
  });

  void it('falls back to untagged rdfs:label when no English is present', () => {
    const subject = 'https://example.com/Item';
    const quads: QuadInterface[] = [
      makeLiteralQuad(subject, RDFS_LABEL, 'Item'),
      makeLiteralQuad(subject, RDFS_LABEL, 'Artikel', 'de')
    ];
    const fragment = runAnnotations(quads);
    const delta = fragment.schemaDeltas.get(subject);

    assert.ok(delta !== undefined);
    assert.strictEqual(delta.title, 'Item');
  });

  void it('emits jt:i18n record when multiple language-tagged labels are present', () => {
    const subject = 'https://example.com/Person';
    const quads: QuadInterface[] = [
      makeLiteralQuad(subject, RDFS_LABEL, 'Person', 'en'),
      makeLiteralQuad(subject, RDFS_LABEL, 'Personne', 'fr'),
      makeLiteralQuad(subject, RDFS_LABEL, 'Person', 'de')
    ];
    const fragment = runAnnotations(quads);
    const deltaRaw = fragment.schemaDeltas.get(subject);

    assert.ok(deltaRaw !== undefined, 'delta must be present for multi-language labels');
    const delta = deltaRaw as Record<string, unknown>;
    const i18n = delta['jt:i18n'] as Record<string, unknown> | undefined;

    assert.ok(i18n !== undefined, 'jt:i18n must be present when multiple language labels exist');
    const labelI18n = i18n.label as null | Record<string, string> | undefined;

    assert.ok(labelI18n !== null && labelI18n !== undefined, 'jt:i18n.label must be an object');
    assert.strictEqual(labelI18n.fr, 'Personne');
  });

  void it('does not emit jt:i18n when only one language is present', () => {
    const subject = 'https://example.com/Thing';
    const quads: QuadInterface[] = [makeLiteralQuad(subject, RDFS_LABEL, 'Thing', 'en')];
    const fragment = runAnnotations(quads);
    const delta = fragment.schemaDeltas.get(subject) as Record<string, unknown> | undefined;

    assert.ok(delta !== undefined);
    assert.strictEqual(delta['jt:i18n'], undefined, 'jt:i18n must not be emitted for a single language');
  });

  // ── Multiple annotations on same entity ───────────────────────────────────

  void it('accumulates title, description, and deprecated on one entity', () => {
    const subject = 'https://example.com/DeprecatedClass';
    const quads: QuadInterface[] = [
      makeLiteralQuad(subject, RDFS_LABEL, 'Old Class'),
      makeLiteralQuad(subject, RDFS_COMMENT, 'This class is deprecated.'),
      makeBooleanLiteralQuad(subject, OWL_DEPRECATED, true)
    ];
    const fragment = runAnnotations(quads);
    const delta = fragment.schemaDeltas.get(subject);

    assert.ok(delta !== undefined);
    assert.strictEqual(delta.title, 'Old Class');
    assert.strictEqual(delta.description, 'This class is deprecated.');
    assert.strictEqual(delta.deprecated, true);
  });

  void it('handles multiple subjects independently', () => {
    const s1 = 'https://example.com/ClassA';
    const s2 = 'https://example.com/ClassB';
    const quads: QuadInterface[] = [
      makeLiteralQuad(s1, RDFS_LABEL, 'Class A'),
      makeLiteralQuad(s2, RDFS_LABEL, 'Class B'),
      makeLiteralQuad(s2, RDFS_COMMENT, 'B description.')
    ];
    const fragment = runAnnotations(quads);

    const d1 = fragment.schemaDeltas.get(s1);
    const d2 = fragment.schemaDeltas.get(s2);

    assert.ok(d1 !== undefined);
    assert.strictEqual(d1.title, 'Class A');
    assert.strictEqual(d1.description, undefined);

    assert.ok(d2 !== undefined);
    assert.strictEqual(d2.title, 'Class B');
    assert.strictEqual(d2.description, 'B description.');
  });

  // ── Unrelated predicates silently skipped ────────────────────────────────

  void it('skips unrelated predicates without producing schemaDeltas', () => {
    const subject = 'https://example.com/Thing';
    const quads: QuadInterface[] = [
      makeIriQuad(subject, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.w3.org/2002/07/owl#Class'),
      makeIriQuad(subject, 'http://www.w3.org/2000/01/rdf-schema#subClassOf', 'https://example.com/Base')
    ];
    const fragment = runAnnotations(quads);

    assert.strictEqual(fragment.schemaDeltas.size, 0, 'unrelated predicates must not produce schemaDeltas');
  });

  // ── skos:altLabel — metadata only ────────────────────────────────────────

  void it('accepts skos:altLabel without producing schema fields', () => {
    const subject = 'https://example.com/Person';
    const quads: QuadInterface[] = [makeLiteralQuad(subject, SKOS_ALT_LABEL, 'Human')];
    const fragment = runAnnotations(quads);

    // altLabel alone should not produce title, description, or deprecated
    const delta = fragment.schemaDeltas.get(subject);

    // An entry may or may not be present depending on jt:i18n, but neither title nor description should be set
    if (delta !== undefined) {
      assert.strictEqual(delta.title, undefined, 'altLabel must not populate title');
      assert.strictEqual(delta.description, undefined, 'altLabel must not populate description');
    }
  });

  // ── $comment combining versionInfo + isDefinedBy + seeAlso ───────────────

  void it('combines versionInfo, isDefinedBy, and seeAlso into a single $comment', () => {
    const subject = 'https://example.com/Ontology';
    const quads: QuadInterface[] = [
      makeLiteralQuad(subject, OWL_VERSION_INFO, '2.0'),
      makeIriQuad(subject, RDFS_IS_DEFINED_BY, 'https://example.com/ns'),
      makeIriQuad(subject, RDFS_SEE_ALSO, 'https://schema.org/')
    ];
    const fragment = runAnnotations(quads);
    const delta = fragment.schemaDeltas.get(subject);

    assert.ok(delta !== undefined);
    assert.ok(typeof delta.$comment === 'string', '$comment must be a string');
    assert.ok(delta.$comment.includes('version: 2.0'), 'must include versionInfo');
    assert.ok(delta.$comment.includes('definedBy: https://example.com/ns'), 'must include isDefinedBy');
    assert.ok(delta.$comment.includes('seeAlso: https://schema.org/'), 'must include seeAlso');
  });

  // ── Bookstore round-trip: AuthorName description ──────────────────────────

  void it('round-trips: AuthorName description survives importAnnotations', () => {
    // AuthorNameSchema carries: description: "A person's name in the book-authorship context..."
    // Forward: OwlProjection emits rdfs:comment on the property node.
    // Reverse: importAnnotations should reconstruct description from the rdfs:comment quad.
    const subject = 'urn:bookstore:AuthorName';
    const description = 'A person’s name in the book-authorship context. Validation is owned by PersonName; this is a domain-specific brand.';
    const quads: QuadInterface[] = [makeLiteralQuad(subject, RDFS_COMMENT, description)];
    const fragment = runAnnotations(quads);
    const delta = fragment.schemaDeltas.get(subject);

    assert.ok(delta !== undefined, 'delta must be present for AuthorName');
    assert.strictEqual(delta.description, description, 'description must round-trip exactly');
  });
});
