/**
 * Unit tests for Curie.expand and Curie.expandWithContext.
 *
 * After D10 dedup: both methods delegate to the same private splitCurie
 * primitive that splits on the FIRST colon only. These tests prove the two
 * methods agree on every input category and that the unified split handles
 * CURIE references that themselves contain colons.
 */

import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';
import { Curie } from '../../src/modules/quads/Curie.js';

const CTX = {
  'ex': 'https://example.com/',
  'owl': 'http://www.w3.org/2002/07/owl#'
};

void describe('Curie.expand and Curie.expandWithContext agreement', { 'concurrency': true }, () => {
  void describe('prefix expansion', () => {
    void it('expand: expands a known prefix', () => {
      const curie = new Curie({ 'ex': 'https://example.com/' });

      assert.equal(curie.expand('ex:Person'), 'https://example.com/Person');
    });

    void it('expandWithContext: expands a known prefix', () => {
      assert.equal(
        Curie.expandWithContext('ex:Person', CTX),
        'https://example.com/Person'
      );
    });

    void it('both methods agree on a simple prefix:local expansion', () => {
      const curie = new Curie(CTX);
      const result = curie.expand('ex:Person');

      assert.equal(Curie.expandWithContext('ex:Person', CTX), result);
    });
  });

  void describe('CURIE reference containing a colon', () => {
    // e.g. ex:foo:bar — the reference component is "foo:bar" (everything after the first colon).
    // split(':', 2) (the old expand() bug) would produce localPart = "foo", losing ":bar".
    // indexOf(':') + slice (the correct approach, now used by both methods) preserves "foo:bar".
    void it('expand: preserves reference component that contains a colon', () => {
      const curie = new Curie({ 'ex': 'https://example.com/' });

      assert.equal(curie.expand('ex:foo:bar'), 'https://example.com/foo:bar');
    });

    void it('expandWithContext: preserves reference component that contains a colon', () => {
      assert.equal(
        Curie.expandWithContext('ex:foo:bar', CTX),
        'https://example.com/foo:bar'
      );
    });

    void it('both methods agree on a reference-with-colon input', () => {
      const curie = new Curie(CTX);
      const result = curie.expand('ex:foo:bar');

      assert.equal(Curie.expandWithContext('ex:foo:bar', CTX), result);
    });
  });

  void describe('absolute IRI passthrough', () => {
    void it('expand: returns http:// IRI unchanged (prefix "http" not registered)', () => {
      const curie = new Curie(CTX);
      const iri = 'http://www.w3.org/2002/07/owl#Class';

      assert.equal(curie.expand(iri), iri);
    });

    void it('expandWithContext: passes http:// IRI through unchanged', () => {
      const iri = 'http://www.w3.org/2002/07/owl#Class';

      assert.equal(Curie.expandWithContext(iri, CTX), iri);
    });

    void it('expand: returns https:// IRI unchanged', () => {
      const curie = new Curie(CTX);
      const iri = 'https://schema.org/name';

      assert.equal(curie.expand(iri), iri);
    });

    void it('expandWithContext: passes https:// IRI through unchanged', () => {
      const iri = 'https://schema.org/name';

      assert.equal(Curie.expandWithContext(iri, CTX), iri);
    });

    void it('expand: returns urn: IRI unchanged', () => {
      const curie = new Curie(CTX);
      const iri = 'urn:bookstore:Book';

      assert.equal(curie.expand(iri), iri);
    });

    void it('expandWithContext: passes urn: IRI through unchanged', () => {
      const iri = 'urn:bookstore:Book';

      assert.equal(Curie.expandWithContext(iri, CTX), iri);
    });

    void it('both methods agree on absolute IRI passthrough', () => {
      const curie = new Curie(CTX);
      const iris = [
        'http://www.w3.org/2002/07/owl#Class',
        'https://schema.org/name',
        'urn:bookstore:Book'
      ];

      for (const iri of iris) {
        assert.equal(
          curie.expand(iri),
          Curie.expandWithContext(iri, CTX),
          `mismatch on ${iri}`
        );
      }
    });
  });

  void describe('no-colon passthrough', () => {
    void it('expand: returns a string with no colon unchanged', () => {
      const curie = new Curie(CTX);

      assert.equal(curie.expand('nocolon'), 'nocolon');
    });

    void it('expandWithContext: returns a string with no colon unchanged', () => {
      assert.equal(Curie.expandWithContext('nocolon', CTX), 'nocolon');
    });

    void it('both methods agree on no-colon input', () => {
      const curie = new Curie(CTX);

      assert.equal(curie.expand('nocolon'), Curie.expandWithContext('nocolon', CTX));
    });
  });

  void describe('unknown prefix', () => {
    void it('expand: returns value unchanged when prefix is not registered', () => {
      const curie = new Curie(CTX);

      assert.equal(curie.expand('unknown:Thing'), 'unknown:Thing');
    });

    void it('expandWithContext: returns value unchanged when prefix not in context', () => {
      assert.equal(Curie.expandWithContext('unknown:Thing', CTX), 'unknown:Thing');
    });

    void it('both methods agree on unknown prefix', () => {
      const curie = new Curie(CTX);
      const value = 'unknown:Thing';

      assert.equal(curie.expand(value), Curie.expandWithContext(value, CTX));
    });
  });

  void describe('blank node passthrough (expandWithContext)', () => {
    void it('expandWithContext: passes blank node through unchanged', () => {
      assert.equal(Curie.expandWithContext('_:b0', CTX), '_:b0');
    });
  });

  void describe('expand caching', () => {
    void it('expand: caches results and returns the same value on repeated calls', () => {
      const curie = new Curie({ 'ex': 'https://example.com/' });
      const first = curie.expand('ex:Person');
      const second = curie.expand('ex:Person');

      assert.equal(first, second);
      assert.equal(first, 'https://example.com/Person');
    });

    void it('expand: caches passthrough of unknown prefix', () => {
      const curie = new Curie(CTX);
      const first = curie.expand('unknown:Thing');
      const second = curie.expand('unknown:Thing');

      assert.equal(first, second);
      assert.equal(first, 'unknown:Thing');
    });
  });
});
