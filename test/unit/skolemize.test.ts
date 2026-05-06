/**
 * Skolemize helper tests — isolated coverage of the IRI minting
 * strategies returned by `Skolemize.hash`, `Skolemize.wellKnownGenid`,
 * `Skolemize.uuid`, `Skolemize.fromProperty`, and `Skolemize.compose`.
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import {
  Hash, Skolemize
} from '../../src/index.js';

const ROOT_CTX = {
  'depth': 0,
  'path': '',
  'value': null as unknown
};

function ctx(value: unknown): { 'depth': number;
  'path': string;
  'value': unknown } {
  return {
    ...ROOT_CTX,
    value
  };
}

const undefinedStrategy = (): string | undefined => {
  return undefined;
};

const literalSecond = (): string => {
  return 'urn:second';
};

const literalThird = (): string => {
  return 'urn:third';
};

const literalFirst = (): string => {
  return 'urn:first';
};

const literalCustomFallback = (): string => {
  return 'urn:custom:fallback';
};

void describe('Skolemize.hash()', () => {
  void it('returns undefined when no baseIRI configured', () => {
    const fn = Skolemize.hash();
    const iri = fn(ctx({ 'name': 'Alice' }));

    assert.equal(iri, undefined);
  });

  void it('mints baseIRI/instances/<hash> with strategy baseIRI', () => {
    const fn = Skolemize.hash({ 'baseIRI': 'https://example.com' });
    const iri = fn(ctx({ 'name': 'Alice' }));

    assert.ok(typeof iri === 'string');
    assert.match(iri, /^https:\/\/example\.com\/instances\//u);
  });

  void it('strips trailing slashes from baseIRI', () => {
    const fn = Skolemize.hash({ 'baseIRI': 'https://example.com///' });
    const iri = fn(ctx({ 'k': 1 }));

    assert.ok(typeof iri === 'string');
    assert.ok(iri.startsWith('https://example.com/instances/'));
  });

  void it('produces deterministic IRI for equal values', () => {
    const fn = Skolemize.hash({ 'baseIRI': 'https://x' });
    const first = fn(ctx({ 'name': 'Z' }));
    const second = fn(ctx({ 'name': 'Z' }));

    assert.equal(first, second);
  });

  void it('hash matches Hash.value() output for the same input', () => {
    const value = { 'k': 'v' };
    const fn = Skolemize.hash({ 'baseIRI': 'https://example.com' });
    const iri = fn(ctx(value));

    assert.equal(iri, `https://example.com/instances/${Hash.value(value)}`);
  });
});

void describe('Skolemize.wellKnownGenid()', () => {
  void it('mints IRIs containing the well-known genid path', () => {
    const fn = Skolemize.wellKnownGenid('https://example.com');
    const iri = fn(ctx({ 'k': 1 }));

    assert.ok(typeof iri === 'string');
    assert.match(iri, /\/\.well-known\/genid\//u);
  });

  void it('isWellKnownGenid recognizes minted IRIs', () => {
    const fn = Skolemize.wellKnownGenid('https://example.com');
    const iri = fn(ctx({ 'k': 1 })) as string;

    assert.equal(Skolemize.isWellKnownGenid(iri), true);
    assert.equal(Skolemize.isWellKnownGenid('https://example.com/instances/abc'), false);
  });

  void it('produces deterministic output for the same input', () => {
    const fn = Skolemize.wellKnownGenid('https://example.com');
    const first = fn(ctx({ 'name': 'Alice' }));
    const second = fn(ctx({ 'name': 'Alice' }));

    assert.equal(first, second);
  });
});

void describe('Skolemize.uuid()', () => {
  void it('returns urn:uuid: IRIs', () => {
    const fn = Skolemize.uuid();
    const iri = fn(ctx(null));

    assert.ok(typeof iri === 'string');
    assert.match(iri, /^urn:uuid:[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/u);
  });

  void it('produces fresh identity on each call', () => {
    const fn = Skolemize.uuid();
    const first = fn(ctx(null));
    const second = fn(ctx(null));

    assert.notEqual(first, second);
  });
});

void describe('Skolemize.fromProperty()', () => {
  void it('mints IRI from named property when present', () => {
    const fn = Skolemize.fromProperty('id', { 'baseIRI': 'https://example.com' });
    const iri = fn(ctx({ 'id': 'alice-001' }));

    assert.equal(iri, 'https://example.com/alice-001');
  });

  void it('uses raw value when no baseIRI provided', () => {
    const fn = Skolemize.fromProperty('id');
    const iri = fn(ctx({ 'id': 'https://example.com/users/alice' }));

    assert.equal(iri, 'https://example.com/users/alice');
  });

  void it('falls through to fallback when property missing', () => {
    const fn = Skolemize.fromProperty('id', {
      'baseIRI': 'https://example.com',
      'fallback': literalCustomFallback
    });
    const iri = fn(ctx({ 'name': 'Alice' }));

    assert.equal(iri, 'urn:custom:fallback');
  });

  void it('falls through to fallback when property is empty string', () => {
    const fn = Skolemize.fromProperty('id', {
      'baseIRI': 'https://example.com',
      'fallback': literalCustomFallback
    });
    const iri = fn(ctx({ 'id': '' }));

    assert.equal(iri, 'urn:custom:fallback');
  });

  void it('default fallback is hash strategy with same baseIRI', () => {
    const fn = Skolemize.fromProperty('id', { 'baseIRI': 'https://example.com' });
    const iri = fn(ctx({ 'name': 'Alice' }));

    assert.ok(typeof iri === 'string');
    assert.match(iri, /^https:\/\/example\.com\/instances\//u);
  });

  void it('encodes property values with reserved URI characters', () => {
    const fn = Skolemize.fromProperty('slug', { 'baseIRI': 'https://example.com' });
    const iri = fn(ctx({ 'slug': 'hello world/foo?bar' }));

    assert.equal(iri, `https://example.com/${encodeURIComponent('hello world/foo?bar')}`);
  });
});

void describe('Skolemize.compose()', () => {
  void it('returns first non-undefined result', () => {
    const fn = Skolemize.compose(undefinedStrategy, literalSecond, literalThird);
    const iri = fn(ctx(null));

    assert.equal(iri, 'urn:second');
  });

  void it('returns undefined when every strategy returns undefined', () => {
    const fn = Skolemize.compose(undefinedStrategy, undefinedStrategy);
    const iri = fn(ctx(null));

    assert.equal(iri, undefined);
  });

  void it('composes fromProperty + hash fallback', () => {
    const fn = Skolemize.compose(
      Skolemize.fromProperty('id'),
      Skolemize.hash({ 'baseIRI': 'https://x' })
    );
    const withId = fn(ctx({ 'id': 'https://x/alice' }));
    const withoutId = fn(ctx({ 'name': 'Bob' }));

    assert.equal(withId, 'https://x/alice');
    assert.ok(typeof withoutId === 'string');
    assert.match(withoutId, /^https:\/\/x\/instances\//u);
  });

  void it('does not consult later strategies once one returns', () => {
    let secondCalled = false;
    const second = (): string => {
      secondCalled = true;

      return 'urn:second';
    };
    const fn = Skolemize.compose(literalFirst, second);

    fn(ctx(null));

    assert.equal(secondCalled, false);
  });
});
