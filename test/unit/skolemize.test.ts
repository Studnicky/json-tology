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

void describe('Skolemize.hash() — Good/Bad/Ugly', () => {
  void it('mints IRIs deterministically, strips trailing slashes, returns undefined without baseIri', () => {
    // Bad: returns undefined when no baseIri configured
    const noBase = Skolemize.hash();

    assert.equal(noBase(ctx({ 'name': 'Alice' })), undefined);

    // Good: mints baseIri/instances/<hash>
    const fn = Skolemize.hash({ 'baseIri': 'https://example.com' });
    const iri = fn(ctx({ 'name': 'Alice' }));

    assert.ok(typeof iri === 'string');
    assert.match(iri, /^https:\/\/example\.com\/instances\//u);

    // Ugly: strips trailing slashes from baseIri
    const stripped = Skolemize.hash({ 'baseIri': 'https://example.com///' });
    const strippedIri = stripped(ctx({ 'k': 1 }));

    assert.ok(typeof strippedIri === 'string');
    assert.ok((strippedIri).startsWith('https://example.com/instances/'));

    // Good: produces deterministic IRI for equal values
    const fn2 = Skolemize.hash({ 'baseIri': 'https://x' });

    assert.equal(fn2(ctx({ 'name': 'Z' })), fn2(ctx({ 'name': 'Z' })));

    // Good: hash matches Hash.value() output
    const value = { 'k': 'v' };
    const fn3 = Skolemize.hash({ 'baseIri': 'https://example.com' });

    assert.equal(fn3(ctx(value)), `https://example.com/instances/${Hash.value(value)}`);
  });
});

void describe('Skolemize.wellKnownGenid() — Good/Bad/Ugly', () => {
  void it('mints well-known genid IRIs, recognizes them, and is deterministic', () => {
    // Good: mints IRIs containing the well-known genid path
    const fn = Skolemize.wellKnownGenid('https://example.com');
    const iri = fn(ctx({ 'k': 1 }));

    assert.ok(typeof iri === 'string');
    assert.match(iri, /\/\.well-known\/genid\//u);

    // Good: isWellKnownGenid recognizes minted IRIs
    const iri2 = fn(ctx({ 'k': 1 })) as string;

    assert.equal(Skolemize.isWellKnownGenid(iri2), true);
    assert.equal(Skolemize.isWellKnownGenid('https://example.com/instances/abc'), false);

    // Good: deterministic for same input
    const first = fn(ctx({ 'name': 'Alice' }));
    const second = fn(ctx({ 'name': 'Alice' }));

    assert.equal(first, second);
  });
});

void describe('Skolemize.uuid() — Good/Bad', () => {
  void it('returns urn:uuid: IRIs and produces unique values per call', () => {
    // Good: returns urn:uuid: IRIs
    const fn = Skolemize.uuid();
    const iri = fn(ctx(null));

    assert.ok(typeof iri === 'string');
    assert.match(iri, /^urn:uuid:[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/u);

    // Bad: produces fresh identity on each call
    assert.notEqual(fn(ctx(null)), fn(ctx(null)));
  });
});

void describe('Skolemize.fromProperty() — Good/Bad/Ugly', () => {
  void it('mints from property, falls through to fallback, encodes reserved chars', () => {
    // Good: mints IRI from named property when present
    const fn = Skolemize.fromProperty('id', { 'baseIri': 'https://example.com' });

    assert.equal(fn(ctx({ 'id': 'alice-001' })), 'https://example.com/alice-001');

    // Good: uses raw value when no baseIri provided
    const raw = Skolemize.fromProperty('id');

    assert.equal(raw(ctx({ 'id': 'https://example.com/users/alice' })), 'https://example.com/users/alice');

    // Bad: falls through to fallback when property missing
    const withFallback = Skolemize.fromProperty('id', {
      'baseIri': 'https://example.com',
      'fallback': literalCustomFallback
    });

    assert.equal(withFallback(ctx({ 'name': 'Alice' })), 'urn:custom:fallback');

    // Bad: falls through to fallback when property is empty string
    assert.equal(withFallback(ctx({ 'id': '' })), 'urn:custom:fallback');

    // Ugly: default fallback is hash strategy with same baseIri
    const defaultFallback = Skolemize.fromProperty('id', { 'baseIri': 'https://example.com' });
    const defaultFallbackIri = defaultFallback(ctx({ 'name': 'Alice' }));

    assert.ok(typeof defaultFallbackIri === 'string');
    assert.match(defaultFallbackIri, /^https:\/\/example\.com\/instances\//u);

    // Ugly: encodes property values with reserved URI characters
    const encoded = Skolemize.fromProperty('slug', { 'baseIri': 'https://example.com' });

    assert.equal(encoded(ctx({ 'slug': 'hello world/foo?bar' })), `https://example.com/${encodeURIComponent('hello world/foo?bar')}`);
  });
});

void describe('Skolemize.compose() — Good/Bad/Ugly', () => {
  void it('returns first non-undefined result, falls through, and does not call later strategies unnecessarily', () => {
    // Good: returns first non-undefined result
    const fn = Skolemize.compose(undefinedStrategy, literalSecond, literalThird);

    assert.equal(fn(ctx(null)), 'urn:second');

    // Bad: returns undefined when every strategy returns undefined
    const allUndefined = Skolemize.compose(undefinedStrategy, undefinedStrategy);

    assert.equal(allUndefined(ctx(null)), undefined);

    // Good: composes fromProperty + hash fallback
    const composed = Skolemize.compose(
      Skolemize.fromProperty('id'),
      Skolemize.hash({ 'baseIri': 'https://x' })
    );

    assert.equal(composed(ctx({ 'id': 'https://x/alice' })), 'https://x/alice');
    const withoutId = composed(ctx({ 'name': 'Bob' }));

    assert.ok(typeof withoutId === 'string');
    assert.match(withoutId, /^https:\/\/x\/instances\//u);

    // Ugly: does not consult later strategies once one returns
    let secondCalled = false;
    const second = (): string => {
      secondCalled = true;

      return 'urn:second';
    };

    Skolemize.compose(literalFirst, second)(ctx(null));
    assert.equal(secondCalled, false);
  });
});
