/**
 * CURIE Expander Tests
 */

import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { CurieExpander } from '../../src/modules/ontology/CurieExpander.js';

describe('CurieExpander', () => {
  it('should expand a CURIE with known prefix', () => {
    const context = {
      'ex': 'https://example.io/ns#',
    };

    const expander = new CurieExpander(context);
    const expanded = expander.expand('ex:Thing');

    assert.strictEqual(expanded, '<https://example.io/ns#Thing>');
  });

  it('should expand with @vocab when no prefix matches', () => {
    const context = {
      '@vocab': 'https://example.io/default#',
      'ex': 'https://example.io/ns#',
    };

    const expander = new CurieExpander(context);
    const expanded = expander.expand('Thing');

    assert.strictEqual(expanded, '<https://example.io/default#Thing>');
  });

  it('should return original value for unknown prefix', () => {
    const context = {
      'ex': 'https://example.io/ns#',
    };

    const expander = new CurieExpander(context);
    const expanded = expander.expand('unknown:Thing');

    assert.strictEqual(expanded, 'unknown:Thing');
  });

  it('should not modify full IRIs', () => {
    const context = {
      'ex': 'https://example.io/ns#',
    };

    const expander = new CurieExpander(context);
    const expanded = expander.expand('https://example.io/ns#Thing');

    assert.strictEqual(expanded, 'https://example.io/ns#Thing');
  });

  it('should not modify values in angle brackets', () => {
    const context = {
      'ex': 'https://example.io/ns#',
    };

    const expander = new CurieExpander(context);
    const expanded = expander.expand('<https://example.io/ns#Thing>');

    assert.strictEqual(expanded, '<https://example.io/ns#Thing>');
  });

  it('should not modify numeric literals', () => {
    const context = {
      'ex': 'https://example.io/ns#',
    };

    const expander = new CurieExpander(context);
    const expanded = expander.expand('42');

    assert.strictEqual(expanded, '42');
  });

  it('should expand tokens in N3 strings', () => {
    const context = {
      'ex': 'https://example.io/ns#',
      'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
    };

    const expander = new CurieExpander(context);
    const n3 = expander.expandTokens('ex:Thing rdf:type owl:Class .');
    const lines = n3.split('\n');

    assert.ok(lines[0].includes('<https://example.io/ns#Thing>'));
  });

  it('should not expand tokens in strings', () => {
    const context = {
      'ex': 'https://example.io/ns#',
    };

    const expander = new CurieExpander(context);
    const n3 = expander.expandTokens('ex:Thing "ex:NotExpanded".');
    const lines = n3.split('\n');

    assert.ok(lines[0].includes('"ex:NotExpanded"'));
  });

  it('should handle empty values', () => {
    const context = {
      'ex': 'https://example.io/ns#',
    };

    const expander = new CurieExpander(context);
    const expanded = expander.expand('');

    assert.strictEqual(expanded, '');
  });

  it('should handle decimal numbers in N3', () => {
    const context = {
      'ex': 'https://example.io/ns#',
    };

    const expander = new CurieExpander(context);
    const n3 = expander.expandTokens('ex:value 3.14 .');
    const lines = n3.split('\n');

    assert.ok(lines[0].includes('3.14'));
  });
});
