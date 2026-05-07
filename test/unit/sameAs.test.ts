import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';
import { JsonTology } from '../../src/index.js';
import { SameAsStore } from '../../src/modules/registry/SameAsStore.js';

const OWL_SAME_AS = 'http://www.w3.org/2002/07/owl#sameAs';

const PersonSchema = {
  '$id': 'urn:example:PersonForSameAs',
  'properties': {
    'id': { 'type': 'string' },
    'name': { 'type': 'string' }
  },
  'required': ['id'],
  'type': 'object'
} as const;

void describe('SameAsStore', () => {
  void it('records distinct pairs', () => {
    const store = new SameAsStore();

    store.add('urn:a', 'urn:b');
    store.add('urn:c', 'urn:d');
    assert.equal(store.all().length, 2);
  });

  void it('is idempotent for repeats in either direction', () => {
    const store = new SameAsStore();

    store.add('urn:a', 'urn:b');
    store.add('urn:a', 'urn:b');
    store.add('urn:b', 'urn:a');
    assert.equal(store.all().length, 1);
  });

  void it('drops self-pairs', () => {
    const store = new SameAsStore();

    store.add('urn:a', 'urn:a');
    assert.equal(store.all().length, 0);
  });

  void it('clear() empties the store', () => {
    const store = new SameAsStore();

    store.add('urn:a', 'urn:b');
    store.clear();
    assert.equal(store.all().length, 0);
  });
});

void describe('JsonTology.sameAs()', () => {
  void it('records assertions on the registry sameAsStore', () => {
    const jt = JsonTology.create({
      'baseIRI': 'urn:example',
      'schemas': [PersonSchema] as const
    });

    jt.sameAs('urn:example:alice', 'urn:example:alice2');
    assert.equal(jt.registry.sameAsStore.all().length, 1);
  });

  void it('emits symmetric owl:sameAs quads in toQuads()', () => {
    const jt = JsonTology.create({
      'baseIRI': 'urn:example',
      'schemas': [PersonSchema] as const
    });

    jt.sameAs('urn:example:alice', 'urn:example:alice2');

    const data = {
      'id': 'a1',
      'name': 'Alice'
    };
    const quads = jt.toQuads(PersonSchema, data, { 'iriFor': 'urn:example:alice' });

    const sameAsQuads = quads.filter((quad) => {
      return quad.predicate === OWL_SAME_AS;
    });

    assert.equal(sameAsQuads.length, 2, 'symmetric pair emitted');

    const forward = sameAsQuads.find((quad) => {
      return quad.subject === 'urn:example:alice'
        && quad.object.value === 'urn:example:alice2';
    });
    const reverse = sameAsQuads.find((quad) => {
      return quad.subject === 'urn:example:alice2'
        && quad.object.value === 'urn:example:alice';
    });

    assert.notEqual(forward, undefined, 'forward quad present');
    assert.notEqual(reverse, undefined, 'reverse quad present');
  });

  void it('emits no sameAs quads when no assertions are recorded', () => {
    const jt = JsonTology.create({
      'baseIRI': 'urn:example',
      'schemas': [PersonSchema] as const
    });
    const quads = jt.toQuads(PersonSchema, { 'id': 'a1' });
    const sameAsQuads = quads.filter((quad) => {
      return quad.predicate === OWL_SAME_AS;
    });

    assert.equal(sameAsQuads.length, 0);
  });

  void it('records multiple distinct assertions', () => {
    const jt = JsonTology.create({
      'baseIRI': 'urn:example',
      'schemas': [PersonSchema] as const
    });

    jt.sameAs('urn:a', 'urn:b');
    jt.sameAs('urn:c', 'urn:d');
    assert.equal(jt.registry.sameAsStore.all().length, 2);

    const quads = jt.toQuads(PersonSchema, { 'id': 'a1' });
    const sameAsQuads = quads.filter((quad) => {
      return quad.predicate === OWL_SAME_AS;
    });

    assert.equal(sameAsQuads.length, 4, 'two pairs, symmetric → 4 quads');
  });

  void it('honors graphIRI when stamping sameAs quads', () => {
    const jt = JsonTology.create({
      'baseIRI': 'urn:example',
      'schemas': [PersonSchema] as const
    });

    jt.sameAs('urn:a', 'urn:b');

    const quads = jt.toQuads(PersonSchema, { 'id': 'x1' }, {
      'graphIRI': 'urn:example:graph1',
      'iriFor': 'urn:example:x'
    });

    const sameAsQuads = quads.filter((quad) => {
      return quad.predicate === OWL_SAME_AS;
    });

    assert.equal(sameAsQuads.length, 2);
    for (const quad of sameAsQuads) {
      assert.equal(quad.graph, 'urn:example:graph1');
    }
  });
});
