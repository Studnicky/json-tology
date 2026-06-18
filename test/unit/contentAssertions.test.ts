/**
 * Runtime content and format assertion tests.
 *
 * Validates the strict-by-default posture for `format`, `contentEncoding`, and
 * `contentMediaType`. Covers:
 *   - format enforced by default (no $vocabulary needed)
 *   - format opt-out via $vocabulary: { format-assertion: false }
 *   - contentEncoding base64 accept/reject
 *   - contentEncoding base64url accept/reject
 *   - contentMediaType application/json accept/reject
 *   - unknown encoding passes unconditionally
 *   - unknown media type passes unconditionally
 *   - content opt-out via $vocabulary: { format-assertion: false }
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { JsonTology } from '../../src/index.js';
import { Predicates } from '../../src/modules/data/Predicates.js';

// ---------------------------------------------------------------------------
// Predicate unit tests
// ---------------------------------------------------------------------------

void describe('Predicates.satisfiesContentEncoding', () => {
  void it('unknown encoding always passes', () => {
    assert.equal(Predicates.satisfiesContentEncoding('anything goes', 'custom-encoding'), true);
  });

  void it('valid base64 passes', () => {
    assert.equal(Predicates.satisfiesContentEncoding('aGVsbG8=', 'base64'), true);
  });

  void it('invalid base64 fails', () => {
    assert.equal(Predicates.satisfiesContentEncoding('not valid base64!!!', 'base64'), false);
  });

  void it('empty string is valid base64', () => {
    assert.equal(Predicates.satisfiesContentEncoding('', 'base64'), true);
  });

  void it('valid base64url passes', () => {
    // "hello" in base64url: aGVsbG8=, but without padding for url variant
    assert.equal(Predicates.satisfiesContentEncoding('aGVsbG8', 'base64url'), true);
  });

  void it('invalid base64url fails', () => {
    assert.equal(Predicates.satisfiesContentEncoding('!@#$', 'base64url'), false);
  });
});

void describe('Predicates.satisfiesContentMediaType', () => {
  void it('unknown media type always passes', () => {
    assert.equal(Predicates.satisfiesContentMediaType('not json', 'text/plain'), true);
  });

  void it('valid JSON string passes for application/json without encoding', () => {
    assert.equal(Predicates.satisfiesContentMediaType('{"key":"value"}', 'application/json'), true);
  });

  void it('invalid JSON string fails for application/json without encoding', () => {
    assert.equal(Predicates.satisfiesContentMediaType('not json', 'application/json'), false);
  });

  void it('valid base64-encoded JSON passes for application/json with base64 encoding', () => {
    // {"key":"value"} base64-encoded
    assert.equal(
      Predicates.satisfiesContentMediaType('eyJrZXkiOiJ2YWx1ZSJ9', 'application/json', 'base64'),
      true
    );
  });

  void it('invalid base64 fails for application/json with base64 encoding', () => {
    assert.equal(
      Predicates.satisfiesContentMediaType('not-base64!!!', 'application/json', 'base64'),
      false
    );
  });

  void it('valid base64 but non-JSON content fails for application/json', () => {
    // "not json" in base64: bm90IGpzb24=
    assert.equal(
      Predicates.satisfiesContentMediaType('bm90IGpzb24=', 'application/json', 'base64'),
      false
    );
  });
});

// ---------------------------------------------------------------------------
// Integration: format enforcement (strict-by-default)
// ---------------------------------------------------------------------------

void describe('format strict-by-default', () => {
  void it('invalid format value rejected when no $vocabulary set', () => {
    const jt = JsonTology.create({ 'baseIri': 'urn:content-test:' });

    jt.set({
      '$id': 'urn:content-test:FormatStrict',
      'format': 'email',
      'type': 'string'
    });

    // Compiled path (registry.is)
    assert.equal(jt.registry.is('urn:content-test:FormatStrict', 'not-an-email'), false, 'compiled: invalid email rejected');
    assert.equal(jt.registry.is('urn:content-test:FormatStrict', 'user@example.com'), true, 'compiled: valid email accepted');
  });

  void it('format opt-out via $vocabulary: format-assertion: false allows invalid format', () => {
    const jt = JsonTology.create({ 'baseIri': 'urn:content-test:' });

    jt.set({
      '$id': 'urn:content-test:FormatOptOut',
      '$schema': 'https://json-schema.org/draft/2020-12/schema',
      '$vocabulary': {
        'https://json-schema.org/draft/2020-12/vocab/applicator': true,
        'https://json-schema.org/draft/2020-12/vocab/content': true,
        'https://json-schema.org/draft/2020-12/vocab/core': true,
        'https://json-schema.org/draft/2020-12/vocab/format-annotation': true,
        'https://json-schema.org/draft/2020-12/vocab/format-assertion': false,
        'https://json-schema.org/draft/2020-12/vocab/meta-data': true,
        'https://json-schema.org/draft/2020-12/vocab/unevaluated': true,
        'https://json-schema.org/draft/2020-12/vocab/validation': true
      },
      'format': 'email',
      'type': 'string'
    });

    // Compiled path: format disabled via vocabulary opt-out
    assert.equal(jt.registry.is('urn:content-test:FormatOptOut', 'not-an-email'), true, 'compiled: format opt-out allows invalid value');
  });

  void it('format opt-in via $vocabulary: format-assertion: true enforces format', () => {
    const jt = JsonTology.create({ 'baseIri': 'urn:content-test:' });

    jt.set({
      '$id': 'urn:content-test:FormatExplicitOn',
      '$schema': 'https://json-schema.org/draft/2020-12/schema',
      '$vocabulary': {
        'https://json-schema.org/draft/2020-12/vocab/applicator': true,
        'https://json-schema.org/draft/2020-12/vocab/content': true,
        'https://json-schema.org/draft/2020-12/vocab/core': true,
        'https://json-schema.org/draft/2020-12/vocab/format-annotation': true,
        'https://json-schema.org/draft/2020-12/vocab/format-assertion': true,
        'https://json-schema.org/draft/2020-12/vocab/meta-data': true,
        'https://json-schema.org/draft/2020-12/vocab/unevaluated': true,
        'https://json-schema.org/draft/2020-12/vocab/validation': true
      },
      'format': 'email',
      'type': 'string'
    });

    assert.equal(jt.registry.is('urn:content-test:FormatExplicitOn', 'not-an-email'), false, 'compiled: explicit on enforces format');
    assert.equal(jt.registry.is('urn:content-test:FormatExplicitOn', 'user@example.com'), true, 'compiled: explicit on accepts valid format');
  });
});

// ---------------------------------------------------------------------------
// Integration: contentEncoding enforcement (strict-by-default)
// ---------------------------------------------------------------------------

void describe('contentEncoding strict-by-default', () => {
  void it('invalid base64 rejected', () => {
    const jt = JsonTology.create({ 'baseIri': 'urn:content-test:' });

    jt.set({
      '$id': 'urn:content-test:Base64Strict',
      'contentEncoding': 'base64',
      'type': 'string'
    });

    // Compiled path
    assert.equal(jt.registry.is('urn:content-test:Base64Strict', 'not valid base64!!!'), false, 'compiled: invalid base64 rejected');
    assert.equal(jt.registry.is('urn:content-test:Base64Strict', 'aGVsbG8='), true, 'compiled: valid base64 accepted');
  });

  void it('unknown encoding passes unconditionally', () => {
    const jt = JsonTology.create({ 'baseIri': 'urn:content-test:' });

    jt.set({
      '$id': 'urn:content-test:UnknownEncoding',
      'contentEncoding': 'quoted-printable',
      'type': 'string'
    });

    assert.equal(jt.registry.is('urn:content-test:UnknownEncoding', 'anything at all'), true, 'unknown encoding: passes');
  });

  void it('contentEncoding opt-out via $vocabulary allows invalid encoding', () => {
    const jt = JsonTology.create({ 'baseIri': 'urn:content-test:' });

    jt.set({
      '$id': 'urn:content-test:EncodingOptOut',
      '$schema': 'https://json-schema.org/draft/2020-12/schema',
      '$vocabulary': {
        'https://json-schema.org/draft/2020-12/vocab/applicator': true,
        'https://json-schema.org/draft/2020-12/vocab/content': true,
        'https://json-schema.org/draft/2020-12/vocab/core': true,
        'https://json-schema.org/draft/2020-12/vocab/format-annotation': true,
        'https://json-schema.org/draft/2020-12/vocab/format-assertion': false,
        'https://json-schema.org/draft/2020-12/vocab/meta-data': true,
        'https://json-schema.org/draft/2020-12/vocab/unevaluated': true,
        'https://json-schema.org/draft/2020-12/vocab/validation': true
      },
      'contentEncoding': 'base64',
      'type': 'string'
    });

    // Compiled path: opt-out disables content encoding assertion
    assert.equal(jt.registry.is('urn:content-test:EncodingOptOut', 'not valid base64!!!'), true, 'compiled: content encoding opt-out allows invalid');
  });
});

// ---------------------------------------------------------------------------
// Integration: contentMediaType enforcement (strict-by-default)
// ---------------------------------------------------------------------------

void describe('contentMediaType strict-by-default', () => {
  void it('invalid JSON content rejected', () => {
    const jt = JsonTology.create({ 'baseIri': 'urn:content-test:' });

    jt.set({
      '$id': 'urn:content-test:JsonMediaType',
      'contentMediaType': 'application/json',
      'type': 'string'
    });

    // Compiled path
    assert.equal(jt.registry.is('urn:content-test:JsonMediaType', 'not json'), false, 'compiled: non-JSON rejected');
    assert.equal(jt.registry.is('urn:content-test:JsonMediaType', '{"key":"value"}'), true, 'compiled: valid JSON accepted');
  });

  void it('base64-encoded JSON: invalid base64 rejected before media type check', () => {
    const jt = JsonTology.create({ 'baseIri': 'urn:content-test:' });

    jt.set({
      '$id': 'urn:content-test:Base64Json',
      'contentEncoding': 'base64',
      'contentMediaType': 'application/json',
      'type': 'string'
    });

    // eyJrZXkiOiJ2YWx1ZSJ9 = {"key":"value"} in base64
    const validData = 'eyJrZXkiOiJ2YWx1ZSJ9';
    // bm90IGpzb24= = "not json" in base64
    const validBase64NonJson = 'bm90IGpzb24=';

    assert.equal(jt.registry.is('urn:content-test:Base64Json', validData), true, 'compiled: valid base64 JSON accepted');
    assert.equal(jt.registry.is('urn:content-test:Base64Json', validBase64NonJson), false, 'compiled: valid base64 non-JSON rejected');
    assert.equal(jt.registry.is('urn:content-test:Base64Json', 'not-base64!!!'), false, 'compiled: invalid base64 rejected');
  });

  void it('unknown media type passes unconditionally', () => {
    const jt = JsonTology.create({ 'baseIri': 'urn:content-test:' });

    jt.set({
      '$id': 'urn:content-test:UnknownMedia',
      'contentMediaType': 'image/png',
      'type': 'string'
    });

    assert.equal(jt.registry.is('urn:content-test:UnknownMedia', 'binary blob'), true, 'unknown media type: passes');
  });
});
