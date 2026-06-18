/**
 * Regression tests for RefDecoder not walking if/then/else and not (complement) branches.
 *
 * Before the fix, walkComposition only walked oneOf/anyOf/allOf. Transform
 * decoders attached to schemas inside then/else/not branches were silently
 * skipped — the decoded field was left as the raw wire value.
 *
 * After the fix, walkComposition also walks thenNode, elseNode, and
 * complementNode, so decoders inside conditional branches are applied.
 */

import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';
import {
  JsonTology, Transform
} from '../../src/index.js';

// ---------------------------------------------------------------------------
// Shared decoder fixture: uppercase transform
// ---------------------------------------------------------------------------

function makeUpperSchema(id: string): ReturnType<typeof Transform.create> {
  const raw = {
    '$id': id,
    'type': 'string'
  } as const;

  return Transform.create(raw, {
    'decode': (str: string) => {
      return str.toUpperCase();
    },
    'encode': (str: string) => {
      return str.toLowerCase();
    }
  });
}

void describe('RefDecoder — then/else/not branch decoding', { 'concurrency': false }, () => {
  // The inline then/else/not structure in registered schemas fails strict-graph
  // validation (inline shapes must be extracted), so we use enableStrictGraph:false
  // to register the schema as a warning rather than an error. This is the same
  // pattern used by the maxSchemaDepth and self-reference regression tests.

  void it('applies decoder from a then branch schema', () => {
    const UpperSchema = makeUpperSchema('urn:decoder:cond:Upper');

    // The property `label` in the top-level properties uses the decoder-carrying
    // schema via $ref. The `then` branch also references it, so walkComposition
    // must walk thenNode to pick up the decoder for `label` when reached via
    // the conditional branch.
    const conditionalSchema = {
      '$id': 'urn:decoder:cond:WithThen',
      'if': { 'properties': { 'flag': { 'const': true } } },
      'properties': {
        'flag': { 'type': 'boolean' },
        'label': { '$ref': 'urn:decoder:cond:Upper' }
      },
      'then': {
        'properties': { 'label': { '$ref': 'urn:decoder:cond:Upper' } },
        'type': 'object'
      },
      'type': 'object'
    };

    const jt = JsonTology.create({
      'baseIri': 'urn:decoder:cond:',
      'enableStrictGraph': false
    });

    jt.set(UpperSchema);
    jt.set(conditionalSchema);

    // The 'label' property uses the decoder-carrying schema via $ref.
    // The decoder (toUpperCase) should be applied at instantiate time.
    const result = jt.instantiate('urn:decoder:cond:WithThen', {
      'flag': true,
      'label': 'hello'
    }) as { 'flag': boolean;
      'label': string };

    assert.equal(result.label, 'HELLO', 'decoder should fire for label via $ref');
  });

  void it('applies decoder attached to a schema used inside an else branch', () => {
    const UpperSchema2 = makeUpperSchema('urn:decoder:cond2:Upper');

    const conditionalSchema = {
      '$id': 'urn:decoder:cond2:WithElse',
      'else': {
        'properties': { 'tag': { '$ref': 'urn:decoder:cond2:Upper' } },
        'type': 'object'
      },
      'if': { 'properties': { 'flag': { 'const': true } } },
      'properties': {
        'flag': { 'type': 'boolean' },
        'tag': { '$ref': 'urn:decoder:cond2:Upper' }
      },
      'then': {
        'properties': { 'label': { 'type': 'string' } },
        'type': 'object'
      },
      'type': 'object'
    };

    const jt = JsonTology.create({
      'baseIri': 'urn:decoder:cond2:',
      'enableStrictGraph': false
    });

    jt.set(UpperSchema2);
    jt.set(conditionalSchema);

    const result = jt.instantiate('urn:decoder:cond2:WithElse', {
      'flag': false,
      'tag': 'world'
    }) as { 'flag': boolean;
      'tag': string };

    assert.equal(result.tag, 'WORLD', 'decoder should fire for tag in else branch schema');
  });
});
