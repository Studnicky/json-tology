import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';

import type { JsonSchemaType } from '../../src/types/Schema.js';
import type { PredicateForType } from '../../src/types/PredicateForType.js';
// PredicateResolver is the single authority for property predicate IRIs; not public surface.
import { PredicateResolver } from '../../src/modules/graph/PredicateResolver.js';

const BASE_IRI = 'https://example.com/';
const CLASS_ID = 'https://example.com/User';
const PROPERTY_NAME = 'name';
// A vocabulary that resolves nothing — every lookup misses, so the resolver
// callback returns undefined and the resolution falls through to the default.
const EMPTY_VOCAB: Record<string, string | undefined> = {};

function resolve(overrides: {
  'baseIRI'?: string;
  'classId'?: string;
  'enableCanonicalPredicates'?: boolean | undefined;
  'predicateFor'?: PredicateForType | undefined;
  'propertyName'?: string;
  'propertySchema'?: JsonSchemaType;
}): string {
  return PredicateResolver.resolve({
    'baseIRI': overrides.baseIRI ?? BASE_IRI,
    'classId': overrides.classId ?? CLASS_ID,
    'enableCanonicalPredicates': overrides.enableCanonicalPredicates,
    'predicateFor': overrides.predicateFor,
    'propertyName': overrides.propertyName ?? PROPERTY_NAME,
    'propertySchema': overrides.propertySchema ?? {}
  });
}

void describe('PredicateResolver.resolve — precedence', { 'concurrency': true }, () => {
  void it('flat default (baseIRI + propertyName) when enableCanonicalPredicates is undefined', () => {
    assert.equal(
      resolve({ 'enableCanonicalPredicates': undefined }),
      'https://example.com/name',
      'undefined → canonical flat default'
    );
  });

  void it('flat default when enableCanonicalPredicates is true', () => {
    assert.equal(
      resolve({ 'enableCanonicalPredicates': true }),
      'https://example.com/name',
      'true → canonical flat default'
    );
  });

  void it('class-scoped (classId#propertyName) when enableCanonicalPredicates is false', () => {
    assert.equal(
      resolve({ 'enableCanonicalPredicates': false }),
      'https://example.com/User#name',
      'false → legacy class-scoped'
    );
  });

  void it('x-jt-predicate wins over canonical flat default', () => {
    assert.equal(
      resolve({
        'enableCanonicalPredicates': true,
        'propertySchema': { 'x-jt-predicate': 'bk:title' }
      }),
      'bk:title',
      'x-jt-predicate honored verbatim over default'
    );
  });

  void it('x-jt-predicate wins over class-scoped opt-out', () => {
    assert.equal(
      resolve({
        'enableCanonicalPredicates': false,
        'propertySchema': { 'x-jt-predicate': 'https://schema.org/name' }
      }),
      'https://schema.org/name',
      'x-jt-predicate honored verbatim over opt-out'
    );
  });

  void it('x-jt-predicate wins over predicateFor', () => {
    assert.equal(
      resolve({
        'predicateFor': () => {
          return 'https://from-resolver.example/x';
        },
        'propertySchema': { 'x-jt-predicate': 'https://explicit.example/name' }
      }),
      'https://explicit.example/name',
      'explicit per-property binding beats predicateFor'
    );
  });

  void it('absolute $id (contains ://) is honored', () => {
    assert.equal(
      resolve({ 'propertySchema': { '$id': 'https://schema.org/givenName' } }),
      'https://schema.org/givenName',
      'absolute $id used verbatim'
    );
  });

  void it('relative $id is ignored, falling through to default', () => {
    assert.equal(
      resolve({ 'propertySchema': { '$id': '#name' } }),
      'https://example.com/name',
      'relative anchor $id ignored → default'
    );
  });

  void it('predicateFor used when no explicit binding', () => {
    assert.equal(
      resolve({
        'predicateFor': (ctx) => {
          return `urn:p:${ctx.classId}:${ctx.propertyName}`;
        }
      }),
      'urn:p:https://example.com/User:name',
      'predicateFor result used'
    );
  });

  void it('predicateFor undefined return falls through to canonical flat default', () => {
    assert.equal(
      resolve({
        'enableCanonicalPredicates': undefined,
        'predicateFor': (ctx) => {
          return EMPTY_VOCAB[ctx.propertyName];
        }
      }),
      'https://example.com/name',
      'predicateFor undefined → default flat'
    );
  });

  void it('predicateFor undefined return falls through to class-scoped opt-out when disabled', () => {
    assert.equal(
      resolve({
        'enableCanonicalPredicates': false,
        'predicateFor': (ctx) => {
          return EMPTY_VOCAB[ctx.propertyName];
        }
      }),
      'https://example.com/User#name',
      'predicateFor undefined → opt-out class-scoped'
    );
  });

  void it('boolean schema (true) is treated as having no fields → default', () => {
    assert.equal(
      resolve({ 'propertySchema': true }),
      'https://example.com/name',
      'boolean schema falls through to default'
    );
  });
});

void describe('PredicateResolver.forConfig — closure capture', { 'concurrency': true }, () => {
  void it('binds config and applies per-call ctx', () => {
    const resolver = PredicateResolver.forConfig({
      'baseIRI': BASE_IRI,
      'enableCanonicalPredicates': true,
      'predicateFor': undefined
    });

    assert.equal(
      resolver({
        'classId': CLASS_ID,
        'propertyName': 'email',
        'propertySchema': {}
      }),
      'https://example.com/email',
      'bound resolver applies captured config'
    );
  });

  void it('bound resolver honors per-call x-jt-predicate', () => {
    const resolver = PredicateResolver.forConfig({
      'baseIRI': BASE_IRI,
      'enableCanonicalPredicates': false,
      'predicateFor': undefined
    });

    assert.equal(
      resolver({
        'classId': CLASS_ID,
        'propertyName': 'email',
        'propertySchema': { 'x-jt-predicate': 'foaf:mbox' }
      }),
      'foaf:mbox',
      'bound resolver still respects explicit binding'
    );
  });
});

void describe('PredicateResolver.resolve — input validation', { 'concurrency': true }, () => {
  void it('empty x-jt-predicate is ignored, falling through to the flat default', () => {
    assert.equal(
      resolve({
        'enableCanonicalPredicates': true,
        'propertySchema': { 'x-jt-predicate': '' }
      }),
      'https://example.com/name',
      'empty x-jt-predicate does not win — falls through to canonical default'
    );
  });

  void it('$id with a leading :// (no scheme) is rejected as a predicate source', () => {
    // indexOf('://') === 0 means no scheme precedes it — not an absolute IRI,
    // so the $id branch must not match and resolution falls through to default.
    assert.equal(
      resolve({
        'enableCanonicalPredicates': true,
        'propertySchema': { '$id': '://garbage' }
      }),
      'https://example.com/name',
      'leading :// $id is not treated as an absolute predicate IRI'
    );
  });

  void it('valid $id with a scheme is used as the predicate', () => {
    assert.equal(
      resolve({ 'propertySchema': { '$id': 'https://schema.org/name' } }),
      'https://schema.org/name',
      'absolute $id (scheme://) wins as predicate'
    );
  });

  void it('throws on an x-jt-predicate containing a control character', () => {
    assert.throws(
      () => {
        resolve({ 'propertySchema': { 'x-jt-predicate': `https://example.com/na${String.fromCodePoint(0x07)}me` } });
      },
      /INVALID_PREDICATE_IRI|control character/u,
      'control-char predicate IRI rejected'
    );
  });

  void it('throws on an x-jt-predicate containing a space', () => {
    assert.throws(
      () => {
        resolve({ 'propertySchema': { 'x-jt-predicate': 'https://example.com/na me' } });
      },
      /INVALID_PREDICATE_IRI|control character or space/u,
      'space in predicate IRI rejected'
    );
  });

  void it('throws on a $id predicate containing a control character', () => {
    assert.throws(
      () => {
        resolve({ 'propertySchema': { '$id': 'https://example.com/na\nme' } });
      },
      /INVALID_PREDICATE_IRI|control character/u,
      'control-char $id predicate rejected'
    );
  });

  void it('rethrows a throwing predicateFor callback as a structured GraphError with a cause', () => {
    const boom = new Error('callback exploded');

    try {
      resolve({
        'predicateFor': () => {
          throw boom;
        }
      });
      assert.fail('expected resolve to throw');
    } catch (error) {
      assert.ok(error instanceof Error, 'threw an Error');
      assert.match(error.message, /predicateFor callback threw/u, 'wrapped message');
      assert.equal((error as { 'code'?: string }).code, 'INVALID_PREDICATE_IRI', 'GraphError code');
      assert.equal((error as { 'cause'?: unknown }).cause, boom, 'original error preserved as cause');
    }
  });
});
