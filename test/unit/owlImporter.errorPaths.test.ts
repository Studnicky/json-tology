/**
 * Unit tests for OwlImporter error-path hardening (mechanical-pattern-hardening).
 *
 * Covers two behaviors introduced in this branch:
 *
 *   1. Malformed JSON-LD string → OwlImportError with code OWL_IMPORT_PARSE_FAILED
 *      (previously the importer silently returned an empty result)
 *
 *   2. Valid document with an unparseable union-literal in owl:equivalentClass →
 *      entry appears in result.unsupported (previously silently dropped)
 *
 * Inputs are inline synthetic quads / JSON-LD strings. No external fixtures.
 */

import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';
import { OwlImporter } from '../../src/modules/ontology/OwlImporter.js';
import { OwlImportError } from '../../src/errors/OwlImportError.js';
import { OWL_IMPORT_ERROR_CODE } from '../../src/constants/ERROR_CODES.js';
import { Terms } from '../../src/modules/quads/Terms.js';
import {
  OWL, RDF
} from '../../src/constants/IRI.js';

const BASE = 'https://example.com/';
const importer = new OwlImporter({ 'baseIri': BASE });

// ---------------------------------------------------------------------------
// Fix 1 — normalizeInput: malformed JSON-LD string throws OwlImportError
// ---------------------------------------------------------------------------

void describe('OwlImporter.import — malformed JSON-LD string', () => {
  void it('throws OwlImportError with code OWL_IMPORT_PARSE_FAILED on syntax error', () => {
    assert.throws(
      (): void => {
        importer.import('{ not valid json :::');
      },
      (err: unknown): boolean => {
        assert.ok(err instanceof OwlImportError, `expected OwlImportError, got ${String(err)}`);
        assert.equal(err.code, OWL_IMPORT_ERROR_CODE.PARSE_FAILED);

        return true;
      }
    );
  });

  void it('throws OwlImportError when JSON string is a primitive (number)', () => {
    assert.throws(
      (): void => {
        importer.import('42');
      },
      (err: unknown): boolean => {
        assert.ok(err instanceof OwlImportError, `expected OwlImportError, got ${String(err)}`);
        assert.equal(err.code, OWL_IMPORT_ERROR_CODE.PARSE_FAILED);

        return true;
      }
    );
  });

  void it('throws OwlImportError when JSON string is null', () => {
    assert.throws(
      (): void => {
        importer.import('null');
      },
      (err: unknown): boolean => {
        assert.ok(err instanceof OwlImportError, `expected OwlImportError, got ${String(err)}`);
        assert.equal(err.code, OWL_IMPORT_ERROR_CODE.PARSE_FAILED);

        return true;
      }
    );
  });

  void it('chains the original SyntaxError as cause', () => {
    try {
      importer.import('{bad json}');
      assert.fail('expected OwlImportError to be thrown');
    } catch (error) {
      assert.ok(error instanceof OwlImportError);
      assert.ok(error.cause instanceof SyntaxError, 'cause must be the original SyntaxError');
    }
  });
});

// ---------------------------------------------------------------------------
// Fix 4 — parseUnionLiteralWrapper: unparseable literal routes to unsupported
// ---------------------------------------------------------------------------

void describe('OwlImporter.import — unparseable union-literal in owl:equivalentClass', () => {
  void it('records the subject in result.unsupported instead of silently dropping the axiom', () => {
    const classIri = `${BASE}Fruit`;
    const equivalentClassPredicate = OWL.equivalentClass;

    // Build a synthetic quad set:
    //   <Fruit> rdf:type owl:Class
    //   <Fruit> owl:equivalentClass "NOT_JSON_AT_ALL"^^xsd:string
    //
    // The literal value is not JSON — parseUnionLiteralWrapper must route this
    // through ctx.reportUnsupported so the subject appears in result.unsupported.
    const quads = [
      Terms.quad(
        Terms.iri(classIri),
        Terms.iri(RDF.type),
        Terms.iri(OWL.Class),
        Terms.defaultGraph()
      ),
      Terms.quad(
        Terms.iri(classIri),
        Terms.iri(equivalentClassPredicate),
        Terms.literal('NOT_JSON_AT_ALL'),
        Terms.defaultGraph()
      )
    ];

    const result = importer.import(quads);

    // The schema was still emitted (class was declared)
    assert.ok(result.schemas.length > 0, 'should still emit schemas for declared classes');

    // The unparseable axiom must appear in unsupported
    assert.ok(
      result.unsupported.length > 0,
      `expected at least one unsupported entry; got ${result.unsupported.length}`
    );

    const entry = result.unsupported.find((candidate): boolean => {
      return candidate.subjectIri === classIri;
    });

    assert.ok(
      entry !== undefined,
      `expected unsupported entry with subjectIri "${classIri}"; got: ${JSON.stringify(result.unsupported)}`
    );
  });
});
