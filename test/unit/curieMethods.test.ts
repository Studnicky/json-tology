/**
 * Unit tests for JsonTology.fromCurie / JsonTology.toCurie.
 *
 * fromCurie: delegates to the registry's Curie.expand — returns full IRI when
 * the prefix is known; passes unknown strings through unchanged.
 *
 * toCurie: delegates to Curie.compact — returns the CURIE form when a prefix
 * matches the IRI namespace; passes full IRIs without a matching prefix
 * through unchanged.
 *
 * Both paths share the same merged prefix map (STANDARD_PREFIXES merged with
 * any prefixes passed to create()). The tests assert the exact behavior
 * observed from the Curie implementation (longest-prefix wins for compact;
 * exact-prefix-then-colon for expand).
 */

import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';
import { JsonTology } from '../../src/index.js';
import { STANDARD_PREFIXES } from '../../src/constants/STANDARD_PREFIXES.js';

// A minimal schema so create() is valid.
const MarkerSchema = {
  '$id': 'https://test.example/Marker',
  'type': 'object'
} as const;

function makeJt(extraPrefixes?: Record<string, string>): ReturnType<typeof JsonTology.create> {
  return JsonTology.create({
    'baseIri': 'https://test.example',
    'enableStrictGraph': false,
    ...(!(extraPrefixes === undefined) && { 'prefixes': extraPrefixes }),
    'schemas': [MarkerSchema] as const
  });
}

void describe('JsonTology.toCurie', { 'concurrency': true }, () => {
  void it('compacts a standard RDF IRI to its CURIE form', () => {
    const jt = makeJt();
    const rdfType = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

    assert.equal(jt.toCurie(rdfType), 'rdf:type');
  });

  void it('compacts an OWL IRI using the standard owl: prefix', () => {
    const jt = makeJt();

    assert.equal(
      jt.toCurie('http://www.w3.org/2002/07/owl#Class'),
      'owl:Class'
    );
  });

  void it('returns the IRI unchanged when no prefix matches', () => {
    const jt = makeJt();
    const unknown = 'https://unknown.example.org/Thing';

    assert.equal(jt.toCurie(unknown), unknown);
  });

  void it('uses a custom prefix passed to create()', () => {
    const jt = makeJt({ 'bk': 'https://bookstore.example/' });

    assert.equal(
      jt.toCurie('https://bookstore.example/Customer'),
      'bk:Customer'
    );
  });

  void it('picks the longest matching prefix (bk: over https:)', () => {
    // Both 'bk' and a hypothetical shorter match would compete;
    // Curie.compact picks the longest namespace.
    const jt = makeJt({
      'bk': 'https://bookstore.example/',
      'bkp': 'https://bookstore.example/p/'
    });

    assert.equal(
      jt.toCurie('https://bookstore.example/p/Title'),
      'bkp:Title'
    );
  });

  void it('round-trips with fromCurie', () => {
    const jt = makeJt({ 'ex': 'https://test.example/' });
    const iri = 'https://test.example/Marker';
    const curie = jt.toCurie(iri);

    assert.equal(curie, 'ex:Marker');
    assert.equal(jt.fromCurie(curie), iri);
  });
});

void describe('JsonTology.fromCurie', { 'concurrency': true }, () => {
  void it('expands a standard rdf: CURIE to its full IRI', () => {
    const jt = makeJt();

    assert.equal(
      jt.fromCurie('rdf:type'),
      'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'
    );
  });

  void it('expands xsd: prefix correctly', () => {
    const jt = makeJt();

    assert.equal(
      jt.fromCurie('xsd:string'),
      `${STANDARD_PREFIXES.xsd}string`
    );
  });

  void it('returns the input unchanged when prefix is unknown', () => {
    const jt = makeJt();
    const unknown = 'unknown:Thing';

    assert.equal(jt.fromCurie(unknown), unknown);
  });

  void it('returns a plain string (no colon) unchanged', () => {
    const jt = makeJt();

    assert.equal(jt.fromCurie('nocolon'), 'nocolon');
  });

  void it('expands a custom prefix passed to create()', () => {
    const jt = makeJt({ 'bk': 'https://bookstore.example/' });

    assert.equal(
      jt.fromCurie('bk:Customer'),
      'https://bookstore.example/Customer'
    );
  });

  void it('returns an absolute IRI unchanged (already expanded)', () => {
    // An absolute IRI contains ':' but has no registered prefix that equals
    // everything before the first colon ('https').
    const jt = makeJt();
    const iri = 'https://example.org/Thing';

    assert.equal(jt.fromCurie(iri), iri);
  });

  void it('round-trip: expand then compact restores the CURIE', () => {
    const jt = makeJt({ 'ex': 'https://test.example/' });
    const curie = 'ex:Marker';
    const expanded = jt.fromCurie(curie);
    const compacted = jt.toCurie(expanded);

    assert.equal(compacted, curie);
  });
});
