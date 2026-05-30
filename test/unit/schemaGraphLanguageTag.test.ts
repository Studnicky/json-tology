/**
 * SchemaGraph — `x-jt-language` BCP-47 validation (sec 5.2).
 *
 * `extractSemantics` reads the `x-jt-language` annotation into the node's
 * `language` semantic. The value must match the BCP-47 tag shape
 * (`/^[A-Za-z]{1,8}(-[A-Za-z0-9]{1,8})*$/`); malformed tags (a bare newline,
 * `"INVALID!!!"`, etc.) are rejected with a GraphError. Valid tags such as
 * `de`, `en-US`, and `zh-Hant-HK` pass through to the semantics.
 *
 * Driven through `semantics(rootNode)`, which calls `extractSemantics`.
 */

import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';
import { SchemaGraph } from '../../src/modules/graph/SchemaGraph.js';

function languageOf(annotation: string): string | undefined {
  const graph = new SchemaGraph({
    '$id': 'https://example.com/Tagged',
    'type': 'string',
    'x-jt-language': annotation
  });

  return graph.semantics(graph.rootNode).language;
}

void describe('SchemaGraph x-jt-language BCP-47 validation', { 'concurrency': true }, () => {
  void it('accepts a simple primary subtag (de)', () => {
    assert.equal(languageOf('de'), 'de', 'de is a valid BCP-47 tag');
  });

  void it('accepts a region-qualified tag (en-US)', () => {
    assert.equal(languageOf('en-US'), 'en-US', 'en-US is a valid BCP-47 tag');
  });

  void it('accepts a script + region tag (zh-Hant-HK)', () => {
    assert.equal(languageOf('zh-Hant-HK'), 'zh-Hant-HK', 'zh-Hant-HK is a valid BCP-47 tag');
  });

  void it('returns undefined when no x-jt-language is present', () => {
    const graph = new SchemaGraph({
      '$id': 'https://example.com/Plain',
      'type': 'string'
    });

    assert.equal(graph.semantics(graph.rootNode).language, undefined, 'no annotation → undefined');
  });

  void it('rejects a bare newline tag', () => {
    assert.throws(
      () => {
        languageOf('\n');
      },
      /BCP-47|INVALID_LANGUAGE_TAG/u,
      'newline is not a valid BCP-47 tag'
    );
  });

  void it('rejects a tag containing punctuation (INVALID!!!)', () => {
    assert.throws(
      () => {
        languageOf('INVALID!!!');
      },
      /BCP-47|INVALID_LANGUAGE_TAG/u,
      'punctuation is not allowed in a BCP-47 tag'
    );
  });

  void it('rejects a subtag longer than 8 characters', () => {
    assert.throws(
      () => {
        languageOf('toolongsubtag');
      },
      /BCP-47|INVALID_LANGUAGE_TAG/u,
      'subtags are limited to 8 characters'
    );
  });

  void it('rejects an empty tag', () => {
    assert.throws(
      () => {
        languageOf('');
      },
      /BCP-47|INVALID_LANGUAGE_TAG/u,
      'empty string is not a valid BCP-47 tag'
    );
  });
});
